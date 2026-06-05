import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { calcularPagosProgramados } from '../utils/calculos'
import { registrarMovimiento } from '../utils/historial'
import { aplicarPenalizacion, postergarPago } from '../utils/cobranza'

export const useAppStore = create((set, get) => ({
  clientes: [],
  prestamos: [],
  pagos: [],
  historial: [],
  loading: false,
  error: null,

  // ─── CLIENTES ───────────────────────────────────────────────
  fetchClientes: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('fecha_registro', { ascending: false })
    if (error) { set({ error: error.message, loading: false }); return }
    set({ clientes: data, loading: false })
  },

  createCliente: async (clienteData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ ...clienteData, user_id: user.id }])
      .select()
      .single()
    if (error) throw error

    set(state => ({ clientes: [data, ...state.clientes] }))

    await registrarMovimiento({
      tipo_movimiento: 'CREACION_CLIENTE',
      descripcion: `Cliente creado: ${data.nombre} (Tel: ${data.telefono})`,
      cliente_id: data.id,
    })

    return data
  },

  updateCliente: async (id, updates) => {
    const clienteAnterior = get().clientes.find(c => c.id === id)

    const { data, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    set(state => ({
      clientes: state.clientes.map(c => c.id === id ? data : c)
    }))

    await registrarMovimiento({
      tipo_movimiento: 'ACTUALIZACION_CLIENTE',
      descripcion: `Cliente actualizado: ${data.nombre}${
        clienteAnterior?.nombre !== data.nombre
          ? ` (antes: ${clienteAnterior?.nombre})`
          : ''
      }`,
      cliente_id: data.id,
    })

    return data
  },

  deleteCliente: async (id) => {
    const cliente = get().clientes.find(c => c.id === id)

    await registrarMovimiento({
      tipo_movimiento: 'ELIMINACION_CLIENTE',
      descripcion: `Cliente eliminado: ${cliente?.nombre || id} (Tel: ${cliente?.telefono || '—'})`,
    })

    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw error

    set(state => ({ clientes: state.clientes.filter(c => c.id !== id) }))
  },

  // ─── PRÉSTAMOS ──────────────────────────────────────────────
  fetchPrestamos: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('prestamos')
      .select(`*, clientes(id, nombre, telefono)`)
      .order('fecha_creacion', { ascending: false })
    if (error) { set({ error: error.message, loading: false }); return }
    set({ prestamos: data, loading: false })
  },

  createPrestamo: async (prestamoData) => {
    const { data: { user } } = await supabase.auth.getUser()

    const total_a_recuperar = prestamoData.monto_prestado + prestamoData.ganancia_pactada
    const monto_quincenal   = total_a_recuperar / prestamoData.num_quincenas

    const prestamoFinal = {
      ...prestamoData,
      user_id: user.id,
      total_a_recuperar,
      monto_quincenal: parseFloat(monto_quincenal.toFixed(2)),
    }

    const { data: prestamo, error: pError } = await supabase
      .from('prestamos')
      .insert([prestamoFinal])
      .select()
      .single()
    if (pError) throw pError

    const pagos = calcularPagosProgramados(prestamo, user.id)
    const { error: pagosError } = await supabase.from('pagos_programados').insert(pagos)
    if (pagosError) throw pagosError

    set(state => ({ prestamos: [prestamo, ...state.prestamos] }))

    const cliente = get().clientes.find(c => c.id === prestamo.cliente_id)

    await registrarMovimiento({
      tipo_movimiento: 'CREACION_PRESTAMO',
      descripcion: `Préstamo creado para ${cliente?.nombre || prestamo.cliente_id}: $${prestamo.monto_prestado} | ${prestamo.num_quincenas} quincenas | Total a recuperar: $${prestamo.total_a_recuperar}`,
      monto: prestamo.monto_prestado,
      cliente_id: prestamo.cliente_id,
      prestamo_id: prestamo.id,
    })

    return prestamo
  },

  updatePrestamo: async (id, updates) => {
    const prestamoAnterior = get().prestamos.find(p => p.id === id)

    const { data, error } = await supabase
      .from('prestamos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    set(state => ({
      prestamos: state.prestamos.map(p => p.id === id ? { ...p, ...data } : p)
    }))

    const cambios = []
    if (prestamoAnterior?.estatus !== data.estatus)
      cambios.push(`estatus: ${prestamoAnterior?.estatus} → ${data.estatus}`)
    if (prestamoAnterior?.monto_prestado !== data.monto_prestado)
      cambios.push(`monto: $${prestamoAnterior?.monto_prestado} → $${data.monto_prestado}`)
    if (prestamoAnterior?.notas !== data.notas)
      cambios.push('notas actualizadas')

    await registrarMovimiento({
      tipo_movimiento: 'EDICION_PRESTAMO',
      descripcion: `Préstamo editado (ID: ${id.slice(0, 8)}…)${cambios.length ? ': ' + cambios.join(', ') : ''}`,
      monto: data.monto_prestado,
      cliente_id: data.cliente_id,
      prestamo_id: data.id,
    })

    return data
  },

  deletePrestamo: async (id) => {
    const prestamo = get().prestamos.find(p => p.id === id)
    const cliente  = get().clientes.find(c => c.id === prestamo?.cliente_id)

    await registrarMovimiento({
      tipo_movimiento: 'ELIMINACION_PRESTAMO',
      descripcion: `Préstamo eliminado: $${prestamo?.monto_prestado} — Cliente: ${cliente?.nombre || '—'} (ID préstamo: ${id.slice(0,8)}…)`,
      monto: prestamo?.monto_prestado ?? null,
      cliente_id: prestamo?.cliente_id ?? null,
    })

    const { error } = await supabase.from('prestamos').delete().eq('id', id)
    if (error) throw error

    set(state => ({ prestamos: state.prestamos.filter(p => p.id !== id) }))
  },

  // ─── PAGOS ──────────────────────────────────────────────────
  fetchPagos: async (prestamoId = null) => {
    let query = supabase
      .from('pagos_programados')
      .select(`*, prestamos(id, monto_prestado, total_a_recuperar, num_quincenas, clientes(nombre, telefono))`)
      .order('fecha_vencimiento', { ascending: true })

    if (prestamoId) query = query.eq('prestamo_id', prestamoId)

    const { data, error } = await query
    if (error) { set({ error: error.message }); return }
    set({ pagos: data })
    return data
  },

  registrarPago: async (pagoId, montoPagado, notas = '') => {
    const { data: pago, error: fetchError } = await supabase
      .from('pagos_programados')
      .select('*')
      .eq('id', pagoId)
      .single()
    if (fetchError) throw fetchError

    const totalPagado   = parseFloat(pago.monto_pagado || 0) + parseFloat(montoPagado)
    const saldoRestante = parseFloat(pago.monto_programado) - totalPagado
    const pagado        = saldoRestante <= 0
    const estatus       = pagado ? 'pagado' : totalPagado > 0 ? 'parcial' : 'pendiente'

    const updates = {
      monto_pagado:   totalPagado,
      saldo_restante: Math.max(0, saldoRestante),
      pagado,
      estatus,
      fecha_pago: new Date().toISOString().split('T')[0],
      notas,
    }

    const { data, error } = await supabase
      .from('pagos_programados')
      .update(updates)
      .eq('id', pagoId)
      .select()
      .single()
    if (error) throw error

    set(state => ({
      pagos: state.pagos.map(p => p.id === pagoId ? { ...p, ...data } : p)
    }))

    const prestamoEnStore = get().prestamos.find(p => p.id === pago.prestamo_id)
    const clienteNombre   = prestamoEnStore?.clientes?.nombre || '—'

    const tipoMov = pagado ? 'PAGO_COMPLETO' : 'PAGO_PARCIAL'
    const desc = pagado
      ? `Pago #${pago.numero_pago} completado — ${clienteNombre} — $${montoPagado}${notas ? ' — ' + notas : ''}`
      : `Pago #${pago.numero_pago} parcial — ${clienteNombre} — $${montoPagado} (saldo pendiente: $${Math.max(0, saldoRestante).toFixed(2)})${notas ? ' — ' + notas : ''}`

    await registrarMovimiento({
      tipo_movimiento: tipoMov,
      descripcion: desc,
      monto: parseFloat(montoPagado),
      cliente_id: prestamoEnStore?.cliente_id ?? null,
      prestamo_id: pago.prestamo_id,
      pago_id: data.id,
    })

    await get().verificarLiquidacion(pago.prestamo_id)

    return data
  },

  // ─── REGISTRAR PAGO DESDE PRÉSTAMOS ─────────────────────────
  // Reutiliza exactamente registrarPago — mismo flujo, mismos efectos.
  // Solo registra un movimiento adicional tipo PAGO_DESDE_PRESTAMO.
  registrarPagoDesdePresatamo: async (pagoId, montoPagado, notas = '') => {
    const result = await get().registrarPago(pagoId, montoPagado, notas)

    // Obtener info para el movimiento adicional
    const pago = get().pagos.find(p => p.id === pagoId) || result
    const prestamoEnStore = get().prestamos.find(p => p.id === (pago?.prestamo_id || result?.prestamo_id))
    const clienteNombre = prestamoEnStore?.clientes?.nombre || '—'

    await registrarMovimiento({
      tipo_movimiento: 'PAGO_DESDE_PRESTAMO',
      descripcion: `Pago registrado desde módulo Préstamos — ${clienteNombre} — Pago #${result?.numero_pago} — $${montoPagado}${notas ? ' — ' + notas : ''}`,
      monto: parseFloat(montoPagado),
      cliente_id: prestamoEnStore?.cliente_id ?? null,
      prestamo_id: prestamoEnStore?.id ?? null,
      pago_id: result?.id ?? null,
    })

    return result
  },

  verificarLiquidacion: async (prestamoId) => {
    const { data: pagos } = await supabase
      .from('pagos_programados')
      .select('pagado')
      .eq('prestamo_id', prestamoId)

    if (pagos && pagos.every(p => p.pagado)) {
      await supabase
        .from('prestamos')
        .update({ estatus: 'liquidado' })
        .eq('id', prestamoId)

      set(state => ({
        prestamos: state.prestamos.map(p =>
          p.id === prestamoId ? { ...p, estatus: 'liquidado' } : p
        )
      }))
    }
  },

  // ─── LIQUIDAR CRÉDITO ────────────────────────────────────────
  liquidarCredito: async (prestamoId, descuentoPct = 10) => {
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Calcular saldo pendiente real
    const { data: pagosPendientes, error: pagosError } = await supabase
      .from('pagos_programados')
      .select('*')
      .eq('prestamo_id', prestamoId)
      .eq('pagado', false)
    if (pagosError) throw pagosError

    const saldoPendiente = pagosPendientes.reduce(
      (sum, p) => sum + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0),
      0
    )

    const descuento = saldoPendiente * (descuentoPct / 100)
    const totalLiquidacion = saldoPendiente - descuento

    // 2. Marcar todos los pagos pendientes como liquidados
    const { error: updatePagosError } = await supabase
      .from('pagos_programados')
      .update({
        pagado: true,
        estatus: 'liquidado',
        fecha_pago: new Date().toISOString().split('T')[0],
        notas: `Liquidación anticipada con ${descuentoPct}% de descuento`,
      })
      .eq('prestamo_id', prestamoId)
      .eq('pagado', false)
    if (updatePagosError) throw updatePagosError

    // 3. Cambiar estatus del préstamo a liquidado
    const { error: updatePrestamoError } = await supabase
      .from('prestamos')
      .update({ estatus: 'liquidado' })
      .eq('id', prestamoId)
    if (updatePrestamoError) throw updatePrestamoError

    // 4. Actualizar store local
    set(state => ({
      prestamos: state.prestamos.map(p =>
        p.id === prestamoId ? { ...p, estatus: 'liquidado' } : p
      ),
      pagos: state.pagos.map(p =>
        p.prestamo_id === prestamoId && !p.pagado
          ? { ...p, pagado: true, estatus: 'liquidado' }
          : p
      ),
    }))

    // 5. Obtener info del préstamo para historial
    const prestamo = get().prestamos.find(p => p.id === prestamoId)
    const clienteNombre = prestamo?.clientes?.nombre || '—'

    await registrarMovimiento({
      tipo_movimiento: 'LIQUIDACION_CREDITO',
      descripcion: `Crédito liquidado anticipadamente — ${clienteNombre} — Saldo pendiente: $${saldoPendiente.toFixed(2)} | Descuento ${descuentoPct}%: $${descuento.toFixed(2)} | Total pagado: $${totalLiquidacion.toFixed(2)}`,
      monto: totalLiquidacion,
      cliente_id: prestamo?.cliente_id ?? null,
      prestamo_id: prestamoId,
    })

    return { saldoPendiente, descuento, totalLiquidacion }
  },

  // ─── HISTORIAL ──────────────────────────────────────────────

  // ─── PENALIZACIÓN ─────────────────────────────────────────────
  aplicarPenalizacionPago: async (pagoId, tipoPenalizacion, valorPenalizacion) => {
    const pago = get().pagos.find(p => p.id === pagoId)
    const prestamo = get().prestamos.find(p => p.id === pago?.prestamo_id)
    const data = await aplicarPenalizacion(pagoId, tipoPenalizacion, valorPenalizacion, prestamo)
    set(state => ({
      pagos: state.pagos.map(p => p.id === pagoId ? { ...p, ...data } : p)
    }))
    return data
  },

  // ─── POSTERGAR ──────────────────────────────────────────────
  postergarPagoProgramado: async (pagoId, tipoRedito, valorRedito) => {
    const pago = get().pagos.find(p => p.id === pagoId)
    const prestamo = get().prestamos.find(p => p.id === pago?.prestamo_id)
    const { pagoActualizado, montoRedito } = await postergarPago(pagoId, tipoRedito, valorRedito, prestamo)
    const { data: pagosActualizados } = await supabase
      .from('pagos_programados')
      .select(`*, prestamos(id, monto_prestado, total_a_recuperar, num_quincenas, clientes(nombre, telefono))`)
      .eq('prestamo_id', pago?.prestamo_id)
      .order('fecha_vencimiento', { ascending: true })
    if (pagosActualizados) {
      set(state => ({
        pagos: state.pagos
          .filter(p => p.prestamo_id !== pago?.prestamo_id)
          .concat(pagosActualizados)
      }))
    }
    return { pagoActualizado, montoRedito }
  },

  fetchHistorial: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('historial_movimientos')
      .select(`
        *,
        clientes(nombre),
        prestamos(monto_prestado, total_a_recuperar)
      `)
      .order('fecha_movimiento', { ascending: false })
      .limit(500)

    if (error) { set({ error: error.message, loading: false }); return }
    set({ historial: data, loading: false })
  },
}))
