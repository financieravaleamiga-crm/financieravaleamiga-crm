/**
 * cobranza.js — Lógica avanzada de cobranza y pago
 * Penalización por atraso, acumulación de quincenas y postergación con rédito.
 */

import { supabase } from '../lib/supabase'
import { registrarMovimiento } from './historial'

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el monto de penalización según tipo y valor del préstamo.
 * @param {number} base       - Saldo base sobre el que se aplica
 * @param {string} tipo       - 'porcentaje' | 'fijo' | 'ninguna'
 * @param {number} valor      - Valor de la penalización
 * @returns {number}
 */
export function calcularPenalizacion(base, tipo, valor) {
  if (!tipo || tipo === 'ninguna' || !valor) return 0
  if (tipo === 'porcentaje') return parseFloat((base * (valor / 100)).toFixed(2))
  if (tipo === 'fijo') return parseFloat(valor)
  return 0
}

/**
 * Calcula el monto del rédito para postergación.
 * @param {number} base       - Monto programado de la quincena
 * @param {string} tipo       - 'porcentaje' | 'fijo'
 * @param {number} valor      - Valor del rédito
 * @returns {number}
 */
export function calcularRedito(base, tipo, valor) {
  if (!tipo || !valor) return 0
  if (tipo === 'porcentaje') return parseFloat((base * (valor / 100)).toFixed(2))
  if (tipo === 'fijo') return parseFloat(valor)
  return 0
}

/**
 * Avanza una fecha 15 días.
 * @param {string} fechaStr   - Fecha en formato YYYY-MM-DD
 * @returns {string}
 */
function avanzar15Dias(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  d.setDate(d.getDate() + 15)
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. APLICAR PENALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Aplica una penalización al saldo de un pago pendiente.
 * Incrementa monto_programado y saldo_restante con la penalización calculada.
 *
 * @param {string} pagoId               - ID del pago a penalizar
 * @param {string} tipoPenalizacion     - 'porcentaje' | 'fijo'
 * @param {number} valorPenalizacion    - Valor numérico de la penalización
 * @param {Object} prestamoInfo         - { id, cliente_id, clientes: { nombre } }
 * @returns {Object}                    - Pago actualizado
 */
export async function aplicarPenalizacion(pagoId, tipoPenalizacion, valorPenalizacion, prestamoInfo) {
  // Fetch pago actual
  const { data: pago, error: fetchError } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('id', pagoId)
    .single()
  if (fetchError) throw fetchError
  if (pago.pagado) throw new Error('No se puede penalizar un pago ya liquidado.')

  const base = parseFloat(pago.saldo_restante ?? pago.monto_programado)
  const montoPen = calcularPenalizacion(base, tipoPenalizacion, valorPenalizacion)
  if (montoPen <= 0) throw new Error('El valor de penalización debe ser mayor a 0.')

  const nuevoMontoProgramado = parseFloat(pago.monto_programado) + montoPen
  const nuevoSaldo = base + montoPen
  const descripcionPen = tipoPenalizacion === 'porcentaje'
    ? `${valorPenalizacion}% sobre $${base.toFixed(2)}`
    : `Monto fijo $${montoPen.toFixed(2)}`

  const { data, error } = await supabase
    .from('pagos_programados')
    .update({
      monto_programado: nuevoMontoProgramado,
      saldo_restante: nuevoSaldo,
      penalizacion_aplicada: true,
      monto_penalizacion: montoPen,
      notas: `Penalización aplicada: ${descripcionPen}${pago.notas ? ' | ' + pago.notas : ''}`,
    })
    .eq('id', pagoId)
    .select()
    .single()
  if (error) throw error

  await registrarMovimiento({
    tipo_movimiento: 'PENALIZACION_APLICADA',
    descripcion: `Penalización aplicada — ${prestamoInfo?.clientes?.nombre || '—'} — Pago #${pago.numero_pago} — ${descripcionPen} → Nuevo saldo: $${nuevoSaldo.toFixed(2)}`,
    monto: montoPen,
    cliente_id: prestamoInfo?.cliente_id ?? null,
    prestamo_id: pago.prestamo_id,
    pago_id: data.id,
  })

  return data
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. POSTERGAR PAGO (rédito)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Posterga el pago de una quincena:
 *   - Registra el cobro del rédito en el pago actual (monto_pagado += redito, estatus = 'postergado')
 *   - Mueve la fecha de vencimiento 15 días
 *   - Acumula en el siguiente pago la quincena postergada + la siguiente
 *   - Genera historial POSTERGACION y PAGO_REDITO
 *
 * @param {string} pagoId               - ID del pago a postergar
 * @param {string} tipoRedito           - 'porcentaje' | 'fijo'
 * @param {number} valorRedito          - Valor numérico del rédito
 * @param {Object} prestamoInfo         - { id, cliente_id, monto_quincenal, clientes: { nombre } }
 * @returns {Object}                    - { pagoActualizado, montoRedito }
 */
export async function postergarPago(pagoId, tipoRedito, valorRedito, prestamoInfo) {
  const { data: pago, error: fetchError } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('id', pagoId)
    .single()
  if (fetchError) throw fetchError
  if (pago.pagado) throw new Error('No se puede postergar un pago ya liquidado.')

  const base = parseFloat(pago.monto_programado)
  const montoRedito = calcularRedito(base, tipoRedito, valorRedito)
  if (montoRedito <= 0) throw new Error('El valor del rédito debe ser mayor a 0.')

  // Nueva fecha de vencimiento (+15 días)
  const nuevaFechaVencimiento = avanzar15Dias(pago.fecha_vencimiento)
  const nuevaFechaRecordatorio = avanzar15Dias(pago.fecha_recordatorio)

  // Marcar pago como postergado y registrar rédito pagado
  const montoPosteriorizacion = parseFloat(pago.monto_pagado || 0) + montoRedito
  const { data: pagoActualizado, error: updateError } = await supabase
    .from('pagos_programados')
    .update({
      monto_pagado: montoPosteriorizacion,
      postergado: true,
      monto_redito: montoRedito,
      estatus: 'postergado',
      fecha_vencimiento: nuevaFechaVencimiento,
      fecha_recordatorio: nuevaFechaRecordatorio,
      notas: `Postergado — rédito pagado: $${montoRedito.toFixed(2)}${pago.notas ? ' | ' + pago.notas : ''}`,
    })
    .eq('id', pagoId)
    .select()
    .single()
  if (updateError) throw updateError

  // Buscar la siguiente quincena (numero_pago + 1 del mismo préstamo)
  const { data: siguientePago } = await supabase
    .from('pagos_programados')
    .select('*')
    .eq('prestamo_id', pago.prestamo_id)
    .eq('numero_pago', pago.numero_pago + 1)
    .single()

  // Si existe siguiente quincena, acumular la postergada + la actual
  if (siguientePago && !siguientePago.pagado) {
    const montoAcumulado = parseFloat(siguientePago.monto_programado) + base
    const desglose = `Quincena anterior postergada: $${base.toFixed(2)} + Quincena actual: $${parseFloat(siguientePago.monto_programado).toFixed(2)} = $${montoAcumulado.toFixed(2)}`
    await supabase
      .from('pagos_programados')
      .update({
        monto_programado: montoAcumulado,
        saldo_restante: montoAcumulado - parseFloat(siguientePago.monto_pagado || 0),
        quincena_acumulada: true,
        detalle_desglose: desglose,
        notas: `Acumulado: ${desglose}${siguientePago.notas ? ' | ' + siguientePago.notas : ''}`,
      })
      .eq('id', siguientePago.id)
  }

  const clienteNombre = prestamoInfo?.clientes?.nombre || '—'
  const descripcionRedito = tipoRedito === 'porcentaje'
    ? `${valorRedito}% de $${base.toFixed(2)}`
    : `Monto fijo $${montoRedito.toFixed(2)}`

  await registrarMovimiento({
    tipo_movimiento: 'PAGO_REDITO',
    descripcion: `Rédito pagado — ${clienteNombre} — Pago #${pago.numero_pago} — ${descripcionRedito} → $${montoRedito.toFixed(2)}`,
    monto: montoRedito,
    cliente_id: prestamoInfo?.cliente_id ?? null,
    prestamo_id: pago.prestamo_id,
    pago_id: pagoActualizado.id,
  })

  await registrarMovimiento({
    tipo_movimiento: 'POSTERGACION',
    descripcion: `Quincena postergada — ${clienteNombre} — Pago #${pago.numero_pago} movido al ${nuevaFechaVencimiento}${siguientePago ? ` — Próximo cobro acumulado: $${(parseFloat(siguientePago.monto_programado) + base).toFixed(2)}` : ''}`,
    monto: base,
    cliente_id: prestamoInfo?.cliente_id ?? null,
    prestamo_id: pago.prestamo_id,
    pago_id: pagoActualizado.id,
  })

  return { pagoActualizado, montoRedito }
}
