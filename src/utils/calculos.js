/**
 * Calcula los pagos programados para un préstamo
 * @param {Object} prestamo - Datos del préstamo
 * @param {string} userId - ID del usuario autenticado
 * @returns {Array} Array de pagos programados
 */
export function calcularPagosProgramados(prestamo, userId) {
  const pagos = []
  const fechaInicio = new Date(prestamo.fecha_inicio + 'T12:00:00')

  for (let i = 1; i <= prestamo.num_quincenas; i++) {
    const fechaVencimiento = new Date(fechaInicio)
    fechaVencimiento.setDate(fechaVencimiento.getDate() + (15 * i))

    const fechaRecordatorio = new Date(fechaVencimiento)
    fechaRecordatorio.setDate(fechaRecordatorio.getDate() - 4)

    pagos.push({
      user_id: userId,
      prestamo_id: prestamo.id,
      numero_pago: i,
      fecha_recordatorio: fechaRecordatorio.toISOString().split('T')[0],
      fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
      monto_programado: prestamo.monto_quincenal,
      monto_pagado: 0,
      saldo_restante: prestamo.monto_quincenal,
      pagado: false,
      estatus: 'pendiente',
    })
  }

  return pagos
}

/**
 * Formatea número como moneda MXN
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formatea fecha en español
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formatea fecha corta
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Retorna estatus de un pago según su fecha
 */
export function getEstatusPago(pago) {
  if (pago.pagado) return 'pagado'
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(pago.fecha_vencimiento + 'T12:00:00')
  if (vencimiento < hoy) return 'vencido'
  const recordatorio = new Date(pago.fecha_recordatorio + 'T12:00:00')
  if (recordatorio <= hoy) return 'proximo'
  return 'pendiente'
}

/**
 * Genera enlace de WhatsApp con mensaje de recordatorio
 */
export function generarWhatsApp(telefono, cliente, pago, prestamo) {
  const tel = telefono.replace(/\D/g, '')
  const fullTel = tel.startsWith('52') ? tel : `52${tel}`

  const mensaje = `Hola ${cliente.nombre} 👋

Le recordamos que tiene un pago próximo a vencer:

💰 *Monto:* ${formatCurrency(pago.monto_programado)}
📅 *Vence:* ${formatDate(pago.fecha_vencimiento)}
🔢 *Pago:* ${pago.numero_pago} de ${prestamo.num_quincenas}
${pago.monto_pagado > 0 ? `✅ *Ya abonado:* ${formatCurrency(pago.monto_pagado)}\n⏳ *Saldo:* ${formatCurrency(pago.saldo_restante)}` : ''}

Por favor realice su pago puntualmente para evitar penalizaciones.

Gracias por su preferencia. 🙏`

  return `https://wa.me/${fullTel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Resumen financiero para el dashboard
 */
export function calcularResumen(prestamos, pagos) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyStr = hoy.toISOString().split('T')[0]

  const totalPrestado = prestamos.reduce((s, p) => s + parseFloat(p.monto_prestado || 0), 0)
  const totalRecuperar = prestamos.reduce((s, p) => s + parseFloat(p.total_a_recuperar || 0), 0)
  const totalRecuperado = pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)
  const totalPendiente = totalRecuperar - totalRecuperado

  const pagosHoy = pagos.filter(p => p.fecha_vencimiento === hoyStr && !p.pagado)
  const pagosVencidos = pagos.filter(p => {
    const v = new Date(p.fecha_vencimiento + 'T12:00:00')
    return v < hoy && !p.pagado
  })
  const pagosProximos = pagos.filter(p => {
    const v = new Date(p.fecha_vencimiento + 'T12:00:00')
    const r = new Date(p.fecha_recordatorio + 'T12:00:00')
    return !p.pagado && v >= hoy && r <= hoy
  })

  return {
    totalPrestado,
    totalRecuperar,
    totalRecuperado,
    totalPendiente,
    prestamosActivos: prestamos.filter(p => p.estatus === 'activo').length,
    prestamosLiquidados: prestamos.filter(p => p.estatus === 'liquidado').length,
    pagosHoy: pagosHoy.length,
    pagosVencidos: pagosVencidos.length,
    pagosProximos: pagosProximos.length,
    montoPagosHoy: pagosHoy.reduce((s, p) => s + parseFloat(p.monto_programado || 0), 0),
    montoVencido: pagosVencidos.reduce((s, p) => s + parseFloat(p.saldo_restante || p.monto_programado || 0), 0),
  }
}
