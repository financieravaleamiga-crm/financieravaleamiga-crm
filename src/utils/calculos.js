/**
 * Calcula los pagos programados para AMBOS tipos de préstamo.
 * Delega al modelo correcto según prestamo.tipo_prestamo.
 */
export function calcularPagosProgramados(prestamo, userId) {
  if (prestamo.tipo_prestamo === 'capital_al_vencimiento') {
    return calcularPagosCapitalVencimiento(prestamo, userId)
  }
  return calcularPagosAmortizado(prestamo, userId)
}

/**
 * Modelo original: Amortización tradicional.
 * Todos los pagos son iguales (capital + interés distribuido).
 */
function calcularPagosAmortizado(prestamo, userId) {
  const pagos = []
  const fechaInicio = new Date(prestamo.fecha_inicio + 'T12:00:00')
  // Compatibilidad: préstamos sin periodicidad asumen quincenal
  const periodicidad = prestamo.periodicidad || 'quincenal'
  const numPagos = prestamo.num_quincenas // campo histórico, representa el número de periodos

  for (let i = 1; i <= numPagos; i++) {
    const fechaVencimiento = new Date(fechaInicio)

    if (periodicidad === 'mensual') {
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i)
    } else {
      // quincenal: cada 15 días
      fechaVencimiento.setDate(fechaVencimiento.getDate() + (15 * i))
    }

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
 * Modelo nuevo: Interés periódico + capital al vencimiento.
 * Cada pago = rendimiento sobre el capital.
 * Último pago = interés del periodo + capital completo.
 */
function calcularPagosCapitalVencimiento(prestamo, userId) {
  const pagos = []
  const fechaInicio   = new Date(prestamo.fecha_inicio + 'T12:00:00')
  const periodicidad  = prestamo.periodicidad || 'mensual'
  const numPagos      = prestamo.num_quincenas // reutilizamos campo histórico
  const capital       = parseFloat(prestamo.monto_prestado)
  const rendPct       = parseFloat(prestamo.rendimiento_pct || 0)
  const interesPeriodo = parseFloat((capital * (rendPct / 100)).toFixed(2))

  for (let i = 1; i <= numPagos; i++) {
    const fechaVencimiento = new Date(fechaInicio)
    if (periodicidad === 'mensual') {
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i)
    } else {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + (15 * i))
    }

    const fechaRecordatorio = new Date(fechaVencimiento)
    fechaRecordatorio.setDate(fechaRecordatorio.getDate() - 4)

    const esUltimo     = i === numPagos
    const montoPago    = esUltimo
      ? parseFloat((interesPeriodo + capital).toFixed(2))
      : interesPeriodo

    pagos.push({
      user_id:             userId,
      prestamo_id:         prestamo.id,
      numero_pago:         i,
      fecha_recordatorio:  fechaRecordatorio.toISOString().split('T')[0],
      fecha_vencimiento:   fechaVencimiento.toISOString().split('T')[0],
      monto_programado:    montoPago,
      monto_pagado:        0,
      saldo_restante:      montoPago,
      pagado:              false,
      estatus:             'pendiente',
      es_pago_capital:     esUltimo,
      monto_capital:       esUltimo ? capital : 0,
      monto_interes:       interesPeriodo,
    })
  }

  return pagos
}

/**
 * Retorna la etiqueta de periodo según la periodicidad del préstamo
 * @param {string} periodicidad - 'quincenal' | 'mensual'
 * @param {boolean} plural - si se quiere la forma plural
 */
export function etiquetaPeriodo(periodicidad, plural = false) {
  if (periodicidad === 'mensual') return plural ? 'meses' : 'mes'
  return plural ? 'quincenas' : 'quincena'
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
  const periodoLabel = etiquetaPeriodo(prestamo.periodicidad || 'quincenal', false)

  const mensaje = `Hola ${cliente.nombre} 👋\n\nLe recordamos que tiene un pago próximo a vencer:\n\n💰 *Monto:* ${formatCurrency(pago.monto_programado)}\n📅 *Vence:* ${formatDate(pago.fecha_vencimiento)}\n🔢 *Pago:* ${pago.numero_pago} de ${prestamo.num_quincenas}\n${pago.monto_pagado > 0 ? `✅ *Ya abonado:* ${formatCurrency(pago.monto_pagado)}\n⏳ *Saldo:* ${formatCurrency(pago.saldo_restante)}` : ''}\n\nPor favor realice su pago puntualmente para evitar penalizaciones.\n\nGracias por su preferencia. 🙏`

  return `https://wa.me/${fullTel}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Resumen financiero para el dashboard
 */
export function calcularResumen(prestamos, pagos) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyStr = hoy.toISOString().split('T')[0]

  // Solo préstamos activos/vencidos afectan cartera activa e indicadores de cobro
  const prestamosActivos = prestamos.filter(
    p => p.estatus === 'activo' || p.estatus === 'vencido'
  )
  const prestamosLiquidados = prestamos.filter(p => p.estatus === 'liquidado')

  // IDs de préstamos activos para filtrar pagos
  const idsActivos = new Set(prestamosActivos.map(p => p.id))
  const idsLiquidados = new Set(prestamosLiquidados.map(p => p.id))

  // Pagos de préstamos activos (cartera vigente)
  const pagosActivos = pagos.filter(p => idsActivos.has(p.prestamo_id))
  // Pagos de préstamos liquidados (capital recuperado)
  const pagosLiquidados = pagos.filter(p => idsLiquidados.has(p.prestamo_id))

  // Cartera activa
  const totalPrestado   = prestamosActivos.reduce((s, p) => s + parseFloat(p.monto_prestado || 0), 0)
  const totalRecuperar  = prestamosActivos.reduce((s, p) => s + parseFloat(p.total_a_recuperar || 0), 0)
  const totalRecuperado = pagosActivos.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)
  const totalPendiente  = totalRecuperar - totalRecuperado

  // Capital recuperado de créditos liquidados
  const capitalRecuperado = pagosLiquidados.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)

  // Cobros (solo de cartera activa)
  const pagosHoy = pagosActivos.filter(p => p.fecha_vencimiento === hoyStr && !p.pagado)
  const pagosVencidos = pagosActivos.filter(p => {
    const v = new Date(p.fecha_vencimiento + 'T12:00:00')
    return v < hoy && !p.pagado
  })
  const pagosProximos = pagosActivos.filter(p => {
    const v = new Date(p.fecha_vencimiento + 'T12:00:00')
    const r = new Date(p.fecha_recordatorio + 'T12:00:00')
    return !p.pagado && v >= hoy && r <= hoy
  })

  return {
    totalPrestado,
    totalRecuperar,
    totalRecuperado,
    totalPendiente,
    capitalRecuperado,
    prestamosActivos: prestamosActivos.length,
    prestamosLiquidados: prestamosLiquidados.length,
    pagosHoy: pagosHoy.length,
    pagosVencidos: pagosVencidos.length,
    pagosProximos: pagosProximos.length,
    montoPagosHoy: pagosHoy.reduce((s, p) => s + parseFloat(p.monto_programado || 0), 0),
    montoVencido: pagosVencidos.reduce((s, p) => s + parseFloat(p.saldo_restante || p.monto_programado || 0), 0),
  }
}
