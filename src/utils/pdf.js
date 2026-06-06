import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate, etiquetaPeriodo } from './calculos'
import { supabase } from '../lib/supabase'

// ─── Colores corporativos (escala de grises/azul oscuro) ────────────────────
const C = {
  black:      [20, 20, 20],
  darkGray:   [60, 60, 60],
  medGray:    [120, 120, 120],
  lightGray:  [200, 200, 200],
  ultraLight: [245, 245, 245],
  white:      [255, 255, 255],
  navy:       [30, 50, 80],
  navyLight:  [230, 236, 244],
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtFecha(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtFechaLarga(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function sumarDias(dateStr, dias) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function linea(doc, y, margin, pageW, grosor = 0.3, color = C.lightGray) {
  doc.setDrawColor(...color)
  doc.setLineWidth(grosor)
  doc.line(margin, y, pageW - margin, y)
}

function seccionTitulo(doc, texto, y, margin, pageW) {
  doc.setFillColor(...C.navy)
  doc.rect(margin, y - 5, pageW - margin * 2, 7, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(texto.toUpperCase(), margin + 3, y)
  return y + 6
}

// ─── Obtener datos de la empresa y banco ────────────────────────────────────
async function obtenerConfigEmpresa() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { empresa: {}, banco: {} }

    const [{ data: empresa }, { data: banco }] = await Promise.all([
      supabase.from('empresa_config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('datos_bancarios').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    return { empresa: empresa || {}, banco: banco || {} }
  } catch {
    return { empresa: {}, banco: {} }
  }
}

// ─── Obtener historial de un préstamo ────────────────────────────────────────
async function obtenerHistorialPrestamo(prestamoId) {
  const { data } = await supabase
    .from('historial_movimientos')
    .select('*')
    .eq('prestamo_id', prestamoId)
    .order('fecha_movimiento', { ascending: true })
  return data || []
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
export async function generarEstadoCuenta(cliente, prestamo, pagos) {
  const { empresa, banco } = await obtenerConfigEmpresa()
  const historial = await obtenerHistorialPrestamo(prestamo.id)

  const doc       = new jsPDF({ format: 'letter', unit: 'mm' })
  const pageW     = doc.internal.pageSize.getWidth()   // 215.9
  const pageH     = doc.internal.pageSize.getHeight()  // 279.4
  const margin    = 14

  const hoy       = new Date()
  const hoyStr    = hoy.toISOString().split('T')[0]
  const validoHasta = sumarDias(hoyStr, 4)

  // ── ENCABEZADO ─────────────────────────────────────────────────────────────
  // Fondo oscuro
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, pageW, 38, 'F')

  // Nombre empresa (izquierda)
  doc.setTextColor(...C.white)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  const nombreEmpresa = empresa.nombre_comercial || empresa.nombre_empresa || 'Mi Empresa'
  doc.text(nombreEmpresa, margin, 14)

  // Contacto empresa (izquierda, pequeño)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 210, 235)
  const contactoLineas = [
    empresa.telefono   ? `Tel: ${empresa.telefono}` : null,
    empresa.correo     ? empresa.correo              : null,
    empresa.direccion  ? empresa.direccion            : null,
    [empresa.ciudad, empresa.estado].filter(Boolean).join(', ') || null,
  ].filter(Boolean)
  contactoLineas.forEach((l, i) => {
    doc.text(l, margin, 20 + i * 4.5)
  })

  // Bloque derecho: ESTADO DE CUENTA
  doc.setFillColor(255, 255, 255, 0.1)
  doc.setTextColor(...C.white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ESTADO DE CUENTA', pageW - margin, 13, { align: 'right' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 210, 235)
  doc.text(`No. Prestamo: ${prestamo.id.slice(0, 8).toUpperCase()}`, pageW - margin, 19, { align: 'right' })
  doc.text(`Generado: ${fmtFechaLarga(hoyStr)}`, pageW - margin, 24, { align: 'right' })
  doc.text(`Valido hasta: ${fmtFechaLarga(validoHasta)}`, pageW - margin, 29, { align: 'right' })

  // Nota de vigencia (banda gris tenue)
  doc.setFillColor(240, 244, 250)
  doc.rect(0, 38, pageW, 7, 'F')
  doc.setTextColor(...C.darkGray)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'El monto de liquidacion anticipada puede cambiar al registrar nuevos pagos, penalizaciones o postergaciones.',
    pageW / 2, 43, { align: 'center' }
  )

  let y = 53

  // ── DATOS DEL CLIENTE / PRÉSTAMO ─────────────────────────────────────────
  y = seccionTitulo(doc, 'Información del cliente', y, margin, pageW)
  y += 5

  const col2 = pageW / 2 + 2
  const labelW = 28

  const setLabel  = () => { doc.setFont('helvetica', 'bold');  doc.setFontSize(8); doc.setTextColor(...C.darkGray) }
  const setValor  = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.black) }

  const clienteRows = [
    ['Cliente:', cliente.nombre],
    ['Telefono:', cliente.telefono || '—'],
    ['Domicilio:', cliente.domicilio || '—'],
  ]
  clienteRows.forEach(([lbl, val]) => {
    setLabel(); doc.text(lbl, margin, y)
    setValor(); doc.text(String(val), margin + labelW, y)
    y += 5.5
  })

  y += 2
  linea(doc, y, margin, pageW)
  y += 5

  // ── RESUMEN DEL PRÉSTAMO ─────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Resumen del prestamo', y, margin, pageW)
  y += 5

  const totalRecuperado = pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)
  const saldoPendiente  = Math.max(0, parseFloat(prestamo.total_a_recuperar) - totalRecuperado)
  const porcentaje      = parseFloat(prestamo.total_a_recuperar) > 0
    ? Math.min(100, (totalRecuperado / parseFloat(prestamo.total_a_recuperar)) * 100).toFixed(1)
    : '0.0'

  const pagosOrdenados = [...pagos].sort((a, b) => a.numero_pago - b.numero_pago)
  const pagoActual     = pagosOrdenados.find(p => !p.pagado) || pagosOrdenados[pagosOrdenados.length - 1]
  const numPagado      = pagosOrdenados.filter(p => p.pagado || p.estatus === 'liquidado').length

  const colMid = (pageW - margin * 2) / 2

  const periodoSingular = etiquetaPeriodo(prestamo.periodicidad || 'quincenal', false)
  const periodoPlural   = etiquetaPeriodo(prestamo.periodicidad || 'quincenal', true)
  const esCapVenc       = prestamo.tipo_prestamo === 'capital_al_vencimiento'

  // Calcular capital e intereses pendientes para capital_al_vencimiento
  const capitalPendientePDF    = esCapVenc
    ? pagos.filter(p => !p.pagado).reduce((s, p) => s + parseFloat(p.monto_capital || 0), 0)
    : null
  const interesesPendientesPDF = esCapVenc
    ? pagos.filter(p => !p.pagado).reduce((s, p) =>
        s + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0) - parseFloat(p.monto_capital || 0), 0)
    : null

  const resumenIzq = esCapVenc ? [
    ['Tipo de préstamo:',     'Cap. al vencimiento'],
    ['Monto prestado:',       formatCurrency(prestamo.monto_prestado)],
    ['Rendimiento por periodo:', `${prestamo.rendimiento_pct}%`],
    ['Total a recuperar:',    formatCurrency(prestamo.total_a_recuperar)],
    [`No. de ${periodoPlural}:`, String(prestamo.num_quincenas)],
  ] : [
    ['Tipo de préstamo:',     'Amortización tradicional'],
    ['Monto prestado:',       formatCurrency(prestamo.monto_prestado)],
    ['Ganancia pactada:',     formatCurrency(prestamo.ganancia_pactada)],
    ['Total a recuperar:',    formatCurrency(prestamo.total_a_recuperar)],
    [`No. de ${periodoPlural}:`, String(prestamo.num_quincenas)],
  ]

  const resumenDer = esCapVenc ? [
    ['Total pagado:',         formatCurrency(totalRecuperado)],
    ['Capital pendiente:',    formatCurrency(capitalPendientePDF)],
    ['Intereses pendientes:', formatCurrency(interesesPendientesPDF)],
    ['Saldo total pend.:',    formatCurrency(saldoPendiente)],
    ['Estatus:',              (prestamo.estatus || '').toUpperCase()],
  ] : [
    ['Total pagado:',         formatCurrency(totalRecuperado)],
    ['Saldo pendiente:',      formatCurrency(saldoPendiente)],
    ['% Recuperado:',         `${porcentaje}%`],
    ['Pago actual:',          pagoActual ? `${numPagado + 1} de ${prestamo.num_quincenas}` : `${prestamo.num_quincenas} de ${prestamo.num_quincenas}`],
    ['Estatus:',              (prestamo.estatus || '').toUpperCase()],
  ]

  const startY2 = y
  resumenIzq.forEach(([lbl, val], i) => {
    setLabel(); doc.text(lbl, margin, startY2 + i * 5.5)
    setValor(); doc.text(String(val), margin + 36, startY2 + i * 5.5)
  })
  resumenDer.forEach(([lbl, val], i) => {
    setLabel(); doc.text(lbl, margin + colMid + 4, startY2 + i * 5.5)
    setValor(); doc.text(String(val), margin + colMid + 4 + 32, startY2 + i * 5.5)
  })

  y = startY2 + resumenIzq.length * 5.5 + 3
  linea(doc, y, margin, pageW)
  y += 5

  // ── PAGO ACTUAL ──────────────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Informacion del pago actual', y, margin, pageW)
  y += 5

  if (pagoActual && !pagoActual.pagado) {
    const fechaVenc = pagoActual.fecha_vencimiento
    const montoVencido = pagosOrdenados
      .filter(p => !p.pagado && new Date(p.fecha_vencimiento + 'T12:00:00') < hoy)
      .reduce((s, p) => s + parseFloat(p.saldo_restante ?? p.monto_programado), 0)

    const penalizaciones = pagosOrdenados
      .filter(p => p.penalizacion_aplicada)
      .reduce((s, p) => s + parseFloat(p.monto_penalizacion || 0), 0)

    const totalRequerido = parseFloat(pagoActual.saldo_restante ?? pagoActual.monto_programado)
      + (montoVencido > 0 ? montoVencido - parseFloat(pagoActual.saldo_restante ?? pagoActual.monto_programado) : 0)

    // Caja resaltada
    doc.setFillColor(...C.navyLight)
    doc.roundedRect(margin, y - 2, pageW - margin * 2, 32, 2, 2, 'F')
    y += 2

    const pagoRows = [
      ['Pago:',                       `${pagoActual.numero_pago} de ${prestamo.num_quincenas}`],
      ['Fecha limite:',               fmtFechaLarga(fechaVenc)],
      ['Monto a pagar:',              formatCurrency(pagoActual.saldo_restante ?? pagoActual.monto_programado)],
      ['Monto vencido acumulado:',    formatCurrency(montoVencido)],
      ['Penalizaciones acumuladas:',  formatCurrency(penalizaciones)],
    ]

    pagoRows.forEach(([lbl, val], i) => {
      setLabel()
      doc.setTextColor(...C.navy)
      doc.text(lbl, margin + 4, y + i * 5.2)
      setValor()
      doc.setTextColor(...C.black)
      doc.text(String(val), margin + 55, y + i * 5.2)
    })

    const yTotal = y + pagoRows.length * 5.2 + 1
    linea(doc, yTotal, margin + 3, pageW - margin - 3, 0.4, C.navy)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.navy)
    doc.text('Total requerido actualmente:', margin + 4, yTotal + 5)
    doc.setFontSize(10)
    doc.text(formatCurrency(saldoPendiente), pageW - margin - 4, yTotal + 5, { align: 'right' })

    y = yTotal + 11
  } else {
    setValor()
    doc.setTextColor(...C.medGray)
    doc.text('No hay pagos pendientes en este prestamo.', margin + 4, y + 5)
    y += 14
  }

  linea(doc, y, margin, pageW)
  y += 5

  // ── LIQUIDACIÓN ANTICIPADA ───────────────────────────────────────────────
  y = seccionTitulo(doc, 'Liquidacion anticipada', y, margin, pageW)
  y += 5

  const descPct = 10
  const descMonto = saldoPendiente * (descPct / 100)
  const totalLiquidar = saldoPendiente - descMonto

  doc.setFillColor(235, 245, 235)
  doc.roundedRect(margin, y - 2, pageW - margin * 2, 22, 2, 2, 'F')
  y += 2

  const liqRows = [
    ['Saldo pendiente:',   formatCurrency(saldoPendiente)],
    ['Descuento (10%):',   `- ${formatCurrency(descMonto)}`],
  ]
  liqRows.forEach(([lbl, val], i) => {
    setLabel()
    doc.setTextColor(...C.darkGray)
    doc.text(lbl, margin + 4, y + i * 5.5)
    setValor()
    doc.setTextColor(...C.black)
    doc.text(String(val), margin + 45, y + i * 5.5)
  })

  linea(doc, y + 12, margin + 3, pageW - margin - 3, 0.4, [100, 160, 100])
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 100, 30)
  doc.text('Liquidacion hoy:', margin + 4, y + 17)
  doc.setFontSize(11)
  doc.text(formatCurrency(totalLiquidar), pageW - margin - 4, y + 17, { align: 'right' })

  y += 24
  linea(doc, y, margin, pageW)
  y += 5

  // ── TABLA DE PAGOS ──────────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Calendario de pagos', y, margin, pageW)
  y += 3

  const estatusLabel = (p) => {
    if (p.estatus === 'liquidado') return 'LIQUIDADO'
    if (p.pagado)                  return 'PAGADO'
    if (p.postergado)              return 'POSTERGADO'
    if (new Date(p.fecha_vencimiento + 'T12:00:00') < hoy && !p.pagado) return 'VENCIDO'
    if (parseFloat(p.monto_pagado || 0) > 0) return 'PARCIAL'
    return 'PENDIENTE'
  }

  const tablaRows = esCapVenc
    ? pagosOrdenados.map(p => [
        p.numero_pago,
        fmtFecha(p.fecha_vencimiento),
        formatCurrency(p.monto_interes || 0),
        parseFloat(p.monto_capital || 0) > 0 ? formatCurrency(p.monto_capital) : '—',
        formatCurrency(p.monto_programado),
        estatusLabel(p),
        parseFloat(p.monto_pagado || 0) > 0      ? formatCurrency(p.monto_pagado)   : '—',
        parseFloat(p.saldo_restante ?? 0) > 0     ? formatCurrency(p.saldo_restante) : '—',
      ])
    : pagosOrdenados.map(p => [
        p.numero_pago,
        fmtFecha(p.fecha_vencimiento),
        formatCurrency(p.monto_programado),
        estatusLabel(p),
        parseFloat(p.monto_pagado || 0) > 0      ? formatCurrency(p.monto_pagado)   : '—',
        parseFloat(p.saldo_restante ?? 0) > 0     ? formatCurrency(p.saldo_restante) : '—',
        p.postergado                              ? 'Si' : '—',
        p.estatus === 'liquidado'                 ? 'Si' : '—',
      ])

  autoTable(doc, {
    startY: y,
    head: [esCapVenc
      ? ['#', 'Fecha', 'Interés', 'Capital', 'Total', 'Estado', 'Pagado', 'Pendiente']
      : ['#', 'Fecha', 'Monto', 'Estado', 'Pagado', 'Pendiente', 'Poster.', 'Liquid.']
    ],
    body: tablaRows,
    styles:      { fontSize: 7, cellPadding: 2, font: 'helvetica', textColor: C.black },
    headStyles:  { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: C.ultraLight },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      [esCapVenc ? 5 : 3]: { halign: 'center' },
      ...(esCapVenc ? {} : { 6: { halign: 'center', cellWidth: 14 }, 7: { halign: 'center', cellWidth: 14 } }),
    },
    didParseCell: (data) => {
      const statusColIdx = esCapVenc ? 5 : 3
      if (data.section === 'body' && data.column.index === statusColIdx) {
        const v = data.cell.raw
        if (v === 'PAGADO' || v === 'LIQUIDADO') data.cell.styles.textColor = [30, 100, 30]
        else if (v === 'VENCIDO')                data.cell.styles.textColor = [180, 30, 30]
        else if (v === 'PARCIAL')                data.cell.styles.textColor = [160, 100, 0]
        else if (v === 'POSTERGADO')             data.cell.styles.textColor = [100, 50, 140]
        else                                     data.cell.styles.textColor = C.medGray
      }
    },
    margin: { left: margin, right: margin },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── RESUMEN DE MOVIMIENTOS ───────────────────────────────────────────────
  if (historial.length > 0) {
    // Nueva página si no hay espacio suficiente
    if (y > pageH - 80) {
      doc.addPage()
      y = 20
    }

    y = seccionTitulo(doc, 'Historial de movimientos', y, margin, pageW)
    y += 3

    const tipoLabel = {
      PAGO_COMPLETO:        'Pago completo',
      PAGO_PARCIAL:         'Pago parcial',
      PAGO_DESDE_PRESTAMO:  'Pago',
      POSTERGACION:         'Postergacion',
      PAGO_REDITO:          'Redito',
      PENALIZACION_APLICADA:'Penalizacion',
      LIQUIDACION_CREDITO:  'Liquidacion anticipada',
      CREACION_PRESTAMO:    'Apertura de credito',
    }

    const movRows = historial.map(m => [
      fmtFecha(m.fecha_movimiento),
      tipoLabel[m.tipo_movimiento] || m.tipo_movimiento,
      m.monto ? formatCurrency(m.monto) : '—',
      m.descripcion?.length > 60 ? m.descripcion.slice(0, 58) + '…' : (m.descripcion || '—'),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Monto', 'Descripcion']],
      body: movRows,
      styles:      { fontSize: 6.5, cellPadding: 2, font: 'helvetica', textColor: C.black },
      headStyles:  { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: C.ultraLight },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 35 },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
    })

    y = doc.lastAutoTable.finalY + 6
  }

  // ── DATOS PARA PAGO ──────────────────────────────────────────────────────
  if (y > pageH - 70) {
    doc.addPage()
    y = 20
  }

  y = seccionTitulo(doc, 'Datos para realizar su pago', y, margin, pageW)
  y += 5

  doc.setFillColor(...C.ultraLight)
  doc.roundedRect(margin, y - 2, pageW - margin * 2, 38, 2, 2, 'F')
  y += 2

  const bancoRows = [
    ['Banco:',          banco.banco    || '—'],
    ['Titular:',        banco.titular  || '—'],
    ['No. de cuenta:',  banco.num_cuenta || '—'],
    ['CLABE:',          banco.clabe    || '—'],
    ['Tarjeta:',        banco.tarjeta  || '—'],
  ]
  const midBanco = Math.ceil(bancoRows.length / 2)
  bancoRows.forEach(([lbl, val], i) => {
    const col = i < midBanco ? margin + 4 : margin + colMid + 4
    const row = i < midBanco ? i : i - midBanco
    setLabel(); doc.setTextColor(...C.navy); doc.text(lbl, col, y + row * 5.5)
    setValor(); doc.setTextColor(...C.black); doc.text(String(val), col + 28, y + row * 5.5)
  })

  if (banco.observaciones) {
    y += midBanco * 5.5 + 3
    linea(doc, y, margin + 3, pageW - margin - 3, 0.3, C.lightGray)
    y += 4
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...C.darkGray)
    doc.text(`Instrucciones: ${banco.observaciones}`, margin + 4, y, {
      maxWidth: pageW - margin * 2 - 8
    })
    y += 8
  }

  // ── PIE DE PÁGINA (todas las páginas) ────────────────────────────────────
  const totalPags = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i)
    linea(doc, pageH - 14, margin, pageW, 0.3, C.lightGray)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medGray)
    doc.text(
      `${nombreEmpresa}  |  Estado de cuenta generado el ${fmtFechaLarga(hoyStr)}  |  Valido hasta el ${fmtFechaLarga(validoHasta)}  |  Pagina ${i} de ${totalPags}`,
      pageW / 2,
      pageH - 9,
      { align: 'center' }
    )
  }

  const nombreArchivo = `estado_cuenta_${cliente.nombre.replace(/\s+/g, '_')}_${hoyStr}.pdf`
  doc.save(nombreArchivo)
}

// Mantener compatibilidad con el nombre anterior
export const generarPDFPrestamo = generarEstadoCuenta

// ─── RECIBO DE COBRO (una sola página) ──────────────────────────────────────
export async function generarReciboCobro(pago, prestamo, cliente, todosPagos) {
  const { empresa, banco } = await obtenerConfigEmpresa()

  const doc    = new jsPDF({ format: 'letter', unit: 'mm' })
  const pageW  = doc.internal.pageSize.getWidth()
  const pageH  = doc.internal.pageSize.getHeight()
  const margin = 16

  const hoy     = new Date()
  const hoyStr  = hoy.toISOString().split('T')[0]

  // Cálculo de totales
  const pagosOrdenados = [...(todosPagos || [])].sort((a, b) => a.numero_pago - b.numero_pago)
  const totalRecuperado = pagosOrdenados.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)
  const saldoPendiente  = Math.max(0, parseFloat(prestamo.total_a_recuperar || 0) - totalRecuperado)
  const descMonto       = saldoPendiente * 0.10
  const totalLiquidar   = saldoPendiente - descMonto
  const montoAPagar     = parseFloat(pago.saldo_restante ?? pago.monto_programado ?? 0)
  const totalPagos      = prestamo.num_quincenas || pagosOrdenados.length

  // ── ENCABEZADO ────────────────────────────────────────────────────────────
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, pageW, 32, 'F')

  const nombreEmpresa = empresa.nombre_comercial || empresa.nombre_empresa || 'Mi Empresa'
  doc.setTextColor(...C.white)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(nombreEmpresa, margin, 13)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 210, 235)
  const lineasContacto = [
    empresa.telefono  ? `Tel: ${empresa.telefono}` : null,
    empresa.correo    || null,
    [empresa.ciudad, empresa.estado].filter(Boolean).join(', ') || null,
  ].filter(Boolean)
  lineasContacto.forEach((l, i) => doc.text(l, margin, 19 + i * 4))

  doc.setTextColor(...C.white)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('RECIBO DE COBRO', pageW - margin, 13, { align: 'right' })
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(190, 210, 235)
  doc.text(`Emitido: ${fmtFechaLarga(hoyStr)}`, pageW - margin, 20, { align: 'right' })
  doc.text(`Ref: ${pago.id?.slice(0, 8).toUpperCase() || '—'}`, pageW - margin, 25, { align: 'right' })

  let y = 42

  // ── DATOS DEL CLIENTE ─────────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Datos del cliente', y, margin, pageW)
  y += 6

  const setLbl = () => { doc.setFont('helvetica', 'bold');  doc.setFontSize(8.5); doc.setTextColor(...C.darkGray) }
  const setVal = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.black) }

  const clienteRows = [
    ['Nombre:',   cliente.nombre    || '—'],
    ['Teléfono:', cliente.telefono  || '—'],
  ]
  clienteRows.forEach(([lbl, val], i) => {
    setLbl(); doc.text(lbl, margin, y + i * 6)
    setVal(); doc.text(String(val), margin + 28, y + i * 6)
  })
  y += clienteRows.length * 6 + 4
  linea(doc, y, margin, pageW)
  y += 5

  // ── DETALLE DEL PAGO ──────────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Detalle del pago', y, margin, pageW)
  y += 6

  // Caja principal
  doc.setFillColor(...C.navyLight)
  doc.roundedRect(margin, y - 3, pageW - margin * 2, 60, 3, 3, 'F')
  y += 2

  const col2 = margin + (pageW - margin * 2) / 2 + 2

  const pagoDetalleIzq = [
    ['Número de pago:',    `${pago.numero_pago} de ${totalPagos}`],
    ['Fecha de emisión:',  fmtFechaLarga(hoyStr)],
    ['Fecha límite:',      fmtFechaLarga(pago.fecha_vencimiento)],
  ]
  const pagoDetalleDer = [
    ['Monto a pagar:',     formatCurrency(montoAPagar)],
    ['Total pendiente:',   formatCurrency(saldoPendiente)],
    ['Para liquidar hoy:', formatCurrency(totalLiquidar)],
  ]

  pagoDetalleIzq.forEach(([lbl, val], i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.navy)
    doc.text(lbl, margin + 5, y + i * 7)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.black)
    doc.text(String(val), margin + 5, y + i * 7 + 3.5)
  })
  pagoDetalleDer.forEach(([lbl, val], i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.navy)
    doc.text(lbl, col2, y + i * 7)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.black)
    // Destacar montos
    if (lbl === 'Para liquidar hoy:') {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 100, 30)
    }
    doc.text(String(val), col2, y + i * 7 + 3.5)
  })

  y += pagoDetalleIzq.length * 7 + 12

  // Línea separadora del total
  linea(doc, y, margin + 4, pageW - margin - 4, 0.4, C.navy)
  y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.navy)
  doc.text('MONTO A PAGAR:', margin + 5, y)
  doc.setFontSize(12); doc.setTextColor(20, 80, 20)
  doc.text(formatCurrency(montoAPagar), pageW - margin - 5, y, { align: 'right' })

  y += 12
  linea(doc, y, margin, pageW)
  y += 6

  // ── DATOS BANCARIOS ───────────────────────────────────────────────────────
  y = seccionTitulo(doc, 'Datos para realizar el pago', y, margin, pageW)
  y += 6

  doc.setFillColor(...C.ultraLight)
  doc.roundedRect(margin, y - 3, pageW - margin * 2, 36, 3, 3, 'F')
  y += 2

  const bancoRows = [
    ['Banco:',         banco.banco      || '—'],
    ['Titular:',       banco.titular    || '—'],
    ['No. de cuenta:', banco.num_cuenta || '—'],
    ['CLABE:',         banco.clabe      || '—'],
    ['Tarjeta:',       banco.tarjeta    || '—'],
  ].filter(([, v]) => v !== '—')  // solo mostrar los que tienen dato

  const mid = Math.ceil(bancoRows.length / 2)
  bancoRows.forEach(([lbl, val], i) => {
    const isRight = i >= mid
    const xBase   = isRight ? col2 : margin + 5
    const row     = isRight ? i - mid : i
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.navy)
    doc.text(lbl, xBase, y + row * 6)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.black)
    doc.text(String(val), xBase + 28, y + row * 6)
  })

  if (banco.observaciones) {
    y += mid * 6 + 4
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.darkGray)
    doc.text(`Instrucciones: ${banco.observaciones}`, margin + 5, y, { maxWidth: pageW - margin * 2 - 8 })
    y += 10
  }

  // ── PIE ───────────────────────────────────────────────────────────────────
  linea(doc, pageH - 14, margin, pageW, 0.3, C.lightGray)
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.medGray)
  doc.text(
    `${nombreEmpresa}  |  Recibo emitido el ${fmtFechaLarga(hoyStr)}  |  Documento no oficial`,
    pageW / 2, pageH - 9, { align: 'center' }
  )

  const nombreArchivo = `recibo_cobro_${(cliente.nombre || 'cliente').replace(/\s+/g, '_')}_pago${pago.numero_pago}_${hoyStr}.pdf`
  doc.save(nombreArchivo)
}

