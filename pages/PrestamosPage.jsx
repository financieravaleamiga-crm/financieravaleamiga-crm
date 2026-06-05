import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { formatCurrency, formatDate, generarWhatsApp } from '../utils/calculos'
import { calcularPenalizacion, calcularRedito } from '../utils/cobranza'
import { generarEstadoCuenta } from '../utils/pdf'
import {
  Banknote, Plus, X, ChevronDown, ChevronUp,
  AlertTriangle, Trash2, MessageCircle, HandCoins, Zap, RotateCcw, FileText,
} from 'lucide-react'

const EMPTY_FORM = {
  cliente_id: '',
  monto_prestado: '',
  ganancia_pactada: '',
  num_quincenas: '6',
  fecha_inicio: new Date().toISOString().split('T')[0],
  tipo_penalizacion: 'ninguna',
  valor_penalizacion: '0',
  estatus: 'activo',
}

const ESTATUS_COLORS = {
  activo:    'bg-brand-100 text-brand-700',
  liquidado: 'bg-gray-100 text-gray-600',
  vencido:   'bg-red-100 text-red-600',
}

const PAGO_ESTATUS_COLORS = {
  pagado:     'bg-green-100 text-green-700',
  liquidado:  'bg-blue-100 text-blue-700',
  parcial:    'bg-amber-100 text-amber-700',
  vencido:    'bg-red-100 text-red-600',
  pendiente:  'bg-gray-100 text-gray-500',
  postergado: 'bg-purple-100 text-purple-700',
}

/* ─── Resumen financiero calculado desde pagos reales ─── */
function calcularResumenPrestamo(prestamo, pagos) {
  const monto     = parseFloat(prestamo.monto_prestado || 0)
  const ganancia  = parseFloat(prestamo.ganancia_pactada || 0)
  const total     = parseFloat(prestamo.total_a_recuperar || monto + ganancia)
  const pagado    = pagos.reduce((s, p) => s + parseFloat(p.monto_pagado || 0), 0)
  const pendiente = Math.max(0, total - pagado)
  const pct       = total > 0 ? Math.min(100, (pagado / total) * 100) : 0
  return { monto, ganancia, total, pagado, pendiente, pct }
}

/* ─── Barra de progreso ─── */
function BarraProgreso({ pct }) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-brand-500' : 'bg-amber-500'
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function PrestamosPage() {
  const {
    prestamos, clientes,
    fetchPrestamos, fetchClientes, fetchPagos,
    createPrestamo, updatePrestamo, deletePrestamo,
    registrarPagoDesdePresatamo, liquidarCredito,
    aplicarPenalizacionPago, postergarPagoProgramado,
    loading,
  } = useAppStore()

  const [showForm, setShowForm]               = useState(false)
  const [form, setForm]                       = useState(EMPTY_FORM)
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState('')
  const [expandedId, setExpandedId]           = useState(null)
  const [pagosPorPrestamo, setPagosPorPrestamo] = useState({})
  const [loadingPagos, setLoadingPagos]       = useState({})
  const [updatingEstatus, setUpdatingEstatus] = useState(null)
  const [confirmDelete, setConfirmDelete]     = useState(null)
  const [deleting, setDeleting]               = useState(false)
  const [generandoPDF, setGenerandoPDF]       = useState(null) // prestamoId

  // Estado modal de pago (mismo flujo que Cobros)
  const [pagoSelected, setPagoSelected]       = useState(null)   // pago a registrar
  const [pagoMonto, setPagoMonto]             = useState('')
  const [pagoNotas, setPagoNotas]             = useState('')
  const [pagoSaving, setPagoSaving]           = useState(false)
  const [pagoError, setPagoError]             = useState('')
  const [pagoModo, setPagoModo]               = useState('pago') // 'pago' | 'penalizacion' | 'postergar'
  const [tipoPen, setTipoPen]                 = useState('porcentaje')
  const [valorPen, setValorPen]               = useState('')
  const [tipoRedito, setTipoRedito]           = useState('porcentaje')
  const [valorRedito, setValorRedito]         = useState('')
  const [pagoSuccess, setPagoSuccess]         = useState('')

  // Estado modal liquidar crédito
  const [liquidarPrestamo, setLiquidarPrestamo] = useState(null) // prestamo a liquidar
  const [descuentoPct, setDescuentoPct]         = useState(10)
  const [liquidando, setLiquidando]             = useState(false)
  const [liquidarError, setLiquidarError]       = useState('')

  useEffect(() => {
    fetchPrestamos()
    fetchClientes()
  }, [])

  const total     = form.monto_prestado && form.ganancia_pactada
    ? parseFloat(form.monto_prestado) + parseFloat(form.ganancia_pactada) : 0
  const quincenal = total && form.num_quincenas
    ? total / parseInt(form.num_quincenas) : 0

  /* ─── Crear préstamo ─── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createPrestamo({
        ...form,
        monto_prestado:     parseFloat(form.monto_prestado),
        ganancia_pactada:   parseFloat(form.ganancia_pactada),
        num_quincenas:      parseInt(form.num_quincenas),
        valor_penalizacion: parseFloat(form.valor_penalizacion),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  /* ─── Expandir préstamo ─── */
  const toggleExpand = async (prestamo) => {
    const id = prestamo.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!pagosPorPrestamo[id]) {
      setLoadingPagos(prev => ({ ...prev, [id]: true }))
      const pagos = await fetchPagos(id)
      setPagosPorPrestamo(prev => ({ ...prev, [id]: pagos || [] }))
      setLoadingPagos(prev => ({ ...prev, [id]: false }))
    }
  }

  /* ─── Marcar vencido ─── */
  const handleGenerarPDF = async (prestamo, e) => {
    if (e) e.stopPropagation()
    setGenerandoPDF(prestamo.id)
    try {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id) || prestamo.clientes || {}
      const pagos = pagosPorPrestamo[prestamo.id] || await fetchPagos(prestamo.id)
      await generarEstadoCuenta(cliente, prestamo, pagos || [])
    } catch (err) {
      console.error('Error al generar PDF:', err)
    } finally {
      setGenerandoPDF(null)
    }
  }

  const handleVencido = async (prestamoId) => {
    setUpdatingEstatus(prestamoId)
    try {
      await updatePrestamo(prestamoId, { estatus: 'vencido' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setUpdatingEstatus(null)
    }
  }

  /* ─── Eliminar préstamo ─── */
  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deletePrestamo(confirmDelete.id)
      setConfirmDelete(null)
      setExpandedId(null)
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  /* ─── Abrir modal de pago ─── */
  const abrirPago = (pago, e, modoInicial = 'pago') => {
    e.stopPropagation()
    setPagoSelected(pago)
    setPagoModo(modoInicial)
    setPagoMonto('')
    setPagoNotas('')
    setPagoError('')
    setPagoSuccess('')
    setTipoPen('porcentaje')
    setValorPen('')
    setTipoRedito('porcentaje')
    setValorRedito('')
  }

  /* ─── Registrar pago (mismo flujo que Cobros) ─── */
  const handleRegistrarPago = async (e) => {
    e.preventDefault()
    setPagoError('')
    setPagoSaving(true)
    try {
      const result = await registrarPagoDesdePresatamo(pagoSelected.id, parseFloat(pagoMonto), pagoNotas)

      // Refrescar pagos del préstamo en el estado local
      const prestamoId = pagoSelected.prestamo_id
      const pagosActualizados = await fetchPagos(prestamoId)
      setPagosPorPrestamo(prev => ({ ...prev, [prestamoId]: pagosActualizados || [] }))

      setPagoSelected(null)
    } catch (err) {
      setPagoError(err.message)
    } finally {
      setPagoSaving(false)
    }
  }

  /* ─── Penalización desde Préstamos ─── */
  const handlePenalizacionPrestamo = async (e) => {
    e.preventDefault()
    setPagoError(''); setPagoSaving(true)
    try {
      await aplicarPenalizacionPago(pagoSelected.id, tipoPen, parseFloat(valorPen))
      const prestamoId = pagoSelected.prestamo_id
      const pagosActualizados = await fetchPagos(prestamoId)
      setPagosPorPrestamo(prev => ({ ...prev, [prestamoId]: pagosActualizados || [] }))
      setPagoSuccess('Penalización aplicada.')
      setTimeout(() => setPagoSelected(null), 1500)
    } catch (err) { setPagoError(err.message) }
    finally { setPagoSaving(false) }
  }

  /* ─── Postergar desde Préstamos ─── */
  const handlePostergarPrestamo = async (e) => {
    e.preventDefault()
    setPagoError(''); setPagoSaving(true)
    try {
      const { montoRedito } = await postergarPagoProgramado(pagoSelected.id, tipoRedito, parseFloat(valorRedito))
      const prestamoId = pagoSelected.prestamo_id
      const pagosActualizados = await fetchPagos(prestamoId)
      setPagosPorPrestamo(prev => ({ ...prev, [prestamoId]: pagosActualizados || [] }))
      setPagoSuccess(`Postergado. Rédito: ${formatCurrency(montoRedito)}`)
      setTimeout(() => setPagoSelected(null), 1800)
    } catch (err) { setPagoError(err.message) }
    finally { setPagoSaving(false) }
  }

  /* ─── Liquidar crédito ─── */
  const handleLiquidar = async () => {
    if (!liquidarPrestamo) return
    setLiquidando(true)
    setLiquidarError('')
    try {
      await liquidarCredito(liquidarPrestamo.id, descuentoPct)

      // Refrescar pagos del préstamo
      const pagosActualizados = await fetchPagos(liquidarPrestamo.id)
      setPagosPorPrestamo(prev => ({ ...prev, [liquidarPrestamo.id]: pagosActualizados || [] }))

      setLiquidarPrestamo(null)
    } catch (err) {
      setLiquidarError(err.message)
    } finally {
      setLiquidando(false)
    }
  }

  /* ─── Calcular datos para modal de liquidación ─── */
  const datosLiquidacion = liquidarPrestamo
    ? (() => {
        const pagos   = pagosPorPrestamo[liquidarPrestamo.id] || []
        const saldo   = pagos
          .filter(p => !p.pagado)
          .reduce((s, p) => s + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0), 0)
        const dcto    = saldo * (descuentoPct / 100)
        const totalLiq = saldo - dcto
        return { saldo, dcto, totalLiq }
      })()
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-600 pt-12 pb-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote size={22} className="text-white" />
            <h1 className="text-white font-black text-xl">Préstamos</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-brand-600 rounded-xl px-3 py-1.5 flex items-center gap-1 text-sm font-bold shadow"
          >
            <Plus size={16} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : prestamos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Banknote size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin préstamos registrados</p>
          </div>
        ) : (
          prestamos.map(p => {
            const isExpanded  = expandedId === p.id
            const pagos       = pagosPorPrestamo[p.id] || []
            const isLoadingP  = loadingPagos[p.id]
            const resumen     = calcularResumenPrestamo(p, pagos)
            const hasPagos    = pagos.length > 0

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card principal */}
                <button className="w-full text-left p-4" onClick={() => toggleExpand(p)}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{p.clientes?.nombre || '—'}</p>
                      <p className="text-xs text-gray-400">{formatDate(p.fecha_inicio)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ESTATUS_COLORS[p.estatus] || 'bg-gray-100 text-gray-600'}`}>
                        {p.estatus}
                      </span>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-gray-400" />
                        : <ChevronDown size={16} className="text-gray-400" />
                      }
                    </div>
                  </div>

                  {/* Resumen financiero (siempre visible en card) */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">Prestado</p>
                      <p className="text-sm font-black text-gray-800">{formatCurrency(p.monto_prestado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Total</p>
                      <p className="text-sm font-black text-brand-600">{formatCurrency(p.total_a_recuperar)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Quincenal</p>
                      <p className="text-sm font-black text-gray-800">{formatCurrency(p.monto_quincenal)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {p.num_quincenas} quincenas · {p.clientes?.telefono}
                  </div>
                </button>

                {/* Resumen financiero expandido con datos reales */}
                {isExpanded && hasPagos && (
                  <div className="mx-4 mb-3 bg-gradient-to-br from-brand-50 to-indigo-50 rounded-2xl p-3 border border-brand-100">
                    <p className="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2">Resumen financiero</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Prestado</span>
                        <span className="font-bold text-gray-700">{formatCurrency(resumen.monto)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ganancia</span>
                        <span className="font-bold text-gray-700">{formatCurrency(resumen.ganancia)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total a recuperar</span>
                        <span className="font-bold text-brand-700">{formatCurrency(resumen.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pagado</span>
                        <span className="font-bold text-green-600">{formatCurrency(resumen.pagado)}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-500">Saldo pendiente</span>
                        <span className={`font-black ${resumen.pendiente > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {formatCurrency(resumen.pendiente)}
                        </span>
                      </div>
                    </div>
                    <BarraProgreso pct={resumen.pct} />
                    <p className="text-right text-xs font-bold text-gray-500 mt-1">
                      {resumen.pct.toFixed(1)}% recuperado
                    </p>
                  </div>
                )}

                {/* Sección expandida */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">

                    {/* Botones de acción del préstamo */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <button
                        onClick={(e) => handleGenerarPDF(p, e)}
                        disabled={generandoPDF === p.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 disabled:opacity-60"
                      >
                        <FileText size={13} />
                        {generandoPDF === p.id ? 'Generando...' : 'Estado de cuenta'}
                      </button>
                      {p.estatus === 'activo' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setLiquidarPrestamo(p) }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5"
                          >
                            <Zap size={13} />
                            Liquidar crédito
                          </button>
                          <button
                            onClick={() => handleVencido(p.id)}
                            disabled={updatingEstatus === p.id}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 disabled:opacity-60"
                          >
                            <AlertTriangle size={13} />
                            {updatingEstatus === p.id ? 'Actualizando...' : 'Marcar vencido'}
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(p) }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5"
                      >
                        <Trash2 size={13} />
                        Eliminar
                      </button>
                    </div>

                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pagos programados</p>

                    {isLoadingP ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-500 border-t-transparent" />
                      </div>
                    ) : pagos.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">Sin pagos programados</p>
                    ) : (
                      pagos.map(pago => {
                        const esPendiente = !pago.pagado && pago.estatus !== 'liquidado'
                        const cliente = p.clientes
                        const waLink = cliente?.telefono
                          ? generarWhatsApp(cliente.telefono, cliente, pago, p)
                          : null

                        return (
                          <div key={pago.id} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-xs font-bold text-gray-700">Pago #{pago.numero_pago}</p>
                                <p className="text-xs text-gray-400">{formatDate(pago.fecha_vencimiento)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-gray-800">{formatCurrency(pago.saldo_restante ?? pago.monto_programado)}</p>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${PAGO_ESTATUS_COLORS[pago.estatus] || 'bg-gray-100 text-gray-500'}`}>
                                  {pago.estatus}
                                </span>
                              </div>
                            </div>

                            {/* Badges de estado especial */}
                            {pago.quincena_acumulada && (
                              <p className="text-xs text-orange-600 font-semibold mb-1">⚠ Quincena acumulada</p>
                            )}
                            {pago.penalizacion_aplicada && (
                              <p className="text-xs text-red-500 font-semibold mb-1">🔴 Penalización: {formatCurrency(pago.monto_penalizacion)}</p>
                            )}
                            {pago.detalle_desglose && (
                              <p className="text-xs text-orange-600 mb-1 italic">{pago.detalle_desglose}</p>
                            )}

                            {/* Botones por pago */}
                            {esPendiente && (
                              <div className="flex gap-1.5 pt-1.5 border-t border-gray-50 flex-wrap">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="bg-green-500 text-white rounded-lg py-1.5 px-2 text-xs font-bold flex items-center justify-center gap-1"
                                  >
                                    <MessageCircle size={12} />WA
                                  </a>
                                )}
                                <button
                                  onClick={(e) => abrirPago(pago, e, 'pago')}
                                  className="flex-1 bg-brand-600 text-white rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1"
                                >
                                  <HandCoins size={12} />
                                  Pago
                                </button>
                                <button
                                  onClick={(e) => abrirPago(pago, e, 'penalizacion')}
                                  className="bg-red-500 text-white rounded-lg py-1.5 px-2 text-xs font-bold flex items-center justify-center gap-1"
                                  title="Aplicar penalización"
                                >
                                  <AlertTriangle size={12} />
                                </button>
                                <button
                                  onClick={(e) => abrirPago(pago, e, 'postergar')}
                                  className="bg-purple-500 text-white rounded-lg py-1.5 px-2 text-xs font-bold flex items-center justify-center gap-1"
                                  title="Postergar con rédito"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              </div>
                            )}

                            {/* Info del pago parcial */}
                            {pago.monto_pagado > 0 && !pago.pagado && (
                              <p className="text-xs text-amber-600 mt-1.5">
                                Abonado: {formatCurrency(pago.monto_pagado)}
                                {pago.postergado && pago.monto_redito > 0 && ` (rédito: ${formatCurrency(pago.monto_redito)})`}
                              </p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ─── Modal: Nuevo Préstamo ─── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-black text-gray-800">Nuevo Préstamo</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={22} /></button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-5 pb-8 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente *</label>
                <select
                  required
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {[
                { label: 'Monto prestado *', key: 'monto_prestado' },
                { label: 'Ganancia pactada *', key: 'ganancia_pactada' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type="number" required min="0" step="0.01"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}

              {total > 0 && (
                <div className="bg-brand-50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-700">Total a recuperar</span>
                    <span className="font-black text-brand-700">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-brand-600 text-xs">Pago quincenal estimado</span>
                    <span className="font-bold text-brand-600 text-xs">{formatCurrency(quincenal)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Número de quincenas *</label>
                <select
                  value={form.num_quincenas}
                  onChange={e => setForm(f => ({ ...f, num_quincenas: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {[1,2,3,4,5,6,8,10,12,16,20,24].map(n => (
                    <option key={n} value={n}>{n} quincenas</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de inicio *</label>
                <input
                  type="date" required
                  value={form.fecha_inicio}
                  onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
              )}

              <button
                type="submit" disabled={saving}
                className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-60"
              >
                {saving ? 'Creando préstamo...' : 'Crear Préstamo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Registrar Pago / Penalizar / Postergar ─── */}
      {pagoSelected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-black text-gray-800">
                {pagoModo === 'pago' && 'Registrar Pago'}
                {pagoModo === 'penalizacion' && 'Aplicar Penalización'}
                {pagoModo === 'postergar' && 'Postergar Pago'}
              </h2>
              <button onClick={() => setPagoSelected(null)} className="text-gray-400"><X size={22} /></button>
            </div>
            <p className="text-sm text-gray-500 px-5 mb-1">
              {pagoSelected.prestamos?.clientes?.nombre || '—'} · Pago #{pagoSelected.numero_pago}
            </p>
            <p className="text-xs text-gray-400 px-5 mb-3">
              Saldo: {formatCurrency(pagoSelected.saldo_restante ?? pagoSelected.monto_programado)} · Vence: {formatDate(pagoSelected.fecha_vencimiento)}
            </p>

            {/* Tabs modo */}
            <div className="flex gap-1.5 px-5 mb-4 shrink-0">
              {[
                { key: 'pago', label: 'Pago', cls: pagoModo === 'pago' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500' },
                { key: 'penalizacion', label: 'Penalizar', cls: pagoModo === 'penalizacion' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500' },
                { key: 'postergar', label: 'Postergar', cls: pagoModo === 'postergar' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500' },
              ].map(({ key, label, cls }) => (
                <button key={key} onClick={() => { setPagoModo(key); setPagoError(''); setPagoSuccess('') }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${cls}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto px-5 pb-8 space-y-3">
              {pagoSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2 font-semibold">{pagoSuccess}</div>
              )}
              {pagoError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{pagoError}</div>
              )}

              {/* PAGO NORMAL */}
              {pagoModo === 'pago' && (
                <form onSubmit={handleRegistrarPago} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Monto a registrar *</label>
                    <input type="number" required min="0.01" step="0.01"
                      value={pagoMonto} onChange={e => setPagoMonto(e.target.value)}
                      placeholder={formatCurrency(pagoSelected.saldo_restante ?? pagoSelected.monto_programado)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                    <input type="text" value={pagoNotas} onChange={e => setPagoNotas(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <button type="submit" disabled={pagoSaving}
                    className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl disabled:opacity-60">
                    {pagoSaving ? 'Guardando...' : 'Confirmar Pago'}
                  </button>
                </form>
              )}

              {/* PENALIZACIÓN */}
              {pagoModo === 'penalizacion' && (
                <form onSubmit={handlePenalizacionPrestamo} className="space-y-3">
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
                    La penalización se suma al saldo pendiente de este pago.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                    <div className="flex gap-2">
                      {['porcentaje', 'fijo'].map(t => (
                        <button key={t} type="button" onClick={() => setTipoPen(t)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                            tipoPen === t ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'
                          }`}>
                          {t === 'porcentaje' ? '% Porcentaje' : '$ Monto Fijo'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tipoPen === 'porcentaje' ? 'Porcentaje (%)' : 'Monto fijo ($)'}
                    </label>
                    <input type="number" required min="0.01" step="0.01"
                      value={valorPen} onChange={e => setValorPen(e.target.value)}
                      placeholder={tipoPen === 'porcentaje' ? 'Ej: 20' : 'Ej: 100'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  {valorPen && parseFloat(valorPen) > 0 && (() => {
                    const base = parseFloat(pagoSelected.saldo_restante ?? pagoSelected.monto_programado)
                    const pen = calcularPenalizacion(base, tipoPen, parseFloat(valorPen))
                    return (
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600"><span>Saldo actual</span><span>{formatCurrency(base)}</span></div>
                        <div className="flex justify-between text-red-600 font-semibold"><span>+ Penalización</span><span>{formatCurrency(pen)}</span></div>
                        <div className="flex justify-between text-gray-800 font-black border-t pt-1"><span>Nuevo saldo</span><span>{formatCurrency(base + pen)}</span></div>
                      </div>
                    )
                  })()}
                  <button type="submit" disabled={pagoSaving}
                    className="w-full bg-red-500 text-white font-bold py-3 rounded-xl disabled:opacity-60">
                    {pagoSaving ? 'Aplicando...' : 'Aplicar Penalización'}
                  </button>
                </form>
              )}

              {/* POSTERGAR */}
              {pagoModo === 'postergar' && (
                <form onSubmit={handlePostergarPrestamo} className="space-y-3">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-purple-700">
                    El cliente paga el rédito y la quincena se acumula al siguiente cobro.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de rédito</label>
                    <div className="flex gap-2">
                      {['porcentaje', 'fijo'].map(t => (
                        <button key={t} type="button" onClick={() => setTipoRedito(t)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                            tipoRedito === t ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-600 border-gray-200'
                          }`}>
                          {t === 'porcentaje' ? '% Porcentaje' : '$ Monto Fijo'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tipoRedito === 'porcentaje' ? 'Porcentaje del rédito (%)' : 'Monto fijo del rédito ($)'}
                    </label>
                    <input type="number" required min="0.01" step="0.01"
                      value={valorRedito} onChange={e => setValorRedito(e.target.value)}
                      placeholder={tipoRedito === 'porcentaje' ? 'Ej: 15' : 'Ej: 75'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  {valorRedito && parseFloat(valorRedito) > 0 && (() => {
                    const base = parseFloat(pagoSelected.monto_programado)
                    const red = calcularRedito(base, tipoRedito, parseFloat(valorRedito))
                    return (
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-600"><span>Quincena normal</span><span>{formatCurrency(base)}</span></div>
                        <div className="flex justify-between text-purple-600 font-semibold"><span>Cliente paga (rédito)</span><span>{formatCurrency(red)}</span></div>
                        <div className="flex justify-between text-orange-600 font-semibold border-t pt-1"><span>Próximo cobro acumula</span><span>+{formatCurrency(base)}</span></div>
                      </div>
                    )
                  })()}
                  <button type="submit" disabled={pagoSaving}
                    className="w-full bg-purple-500 text-white font-bold py-3 rounded-xl disabled:opacity-60">
                    {pagoSaving ? 'Procesando...' : 'Confirmar Postergación'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Liquidar Crédito ─── */}
      {liquidarPrestamo && datosLiquidacion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-gray-800">Liquidar Crédito</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {liquidarPrestamo.clientes?.nombre}
            </p>

            <div className="bg-blue-50 rounded-xl p-3 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Saldo pendiente</span>
                <span className="font-black text-gray-800">{formatCurrency(datosLiquidacion.saldo)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Descuento</span>
                <div className="flex items-center gap-2">
                  <select
                    value={descuentoPct}
                    onChange={e => setDescuentoPct(Number(e.target.value))}
                    className="text-xs border border-blue-200 rounded-lg px-2 py-1 text-blue-700 font-bold bg-white"
                  >
                    {[5, 10, 15, 20, 25, 30].map(n => (
                      <option key={n} value={n}>{n}%</option>
                    ))}
                  </select>
                  <span className="font-bold text-green-600">−{formatCurrency(datosLiquidacion.dcto)}</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-100">
                <span className="text-blue-700 font-bold">Total a liquidar</span>
                <span className="font-black text-blue-700 text-base">{formatCurrency(datosLiquidacion.totalLiq)}</span>
              </div>
            </div>

            {liquidarError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 mb-3">{liquidarError}</div>
            )}

            <p className="text-xs text-gray-400 mb-4 text-center">
              Todos los pagos pendientes se marcarán como liquidados y el préstamo cerrará.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setLiquidarPrestamo(null); setLiquidarError('') }}
                disabled={liquidando}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleLiquidar}
                disabled={liquidando}
                className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
              >
                {liquidando ? 'Procesando...' : 'Confirmar liquidación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Confirmar eliminar ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-black text-gray-800 mb-1">¿Eliminar préstamo?</h3>
            <p className="text-sm text-gray-500 mb-1">
              Cliente: <span className="font-semibold text-gray-700">{confirmDelete.clientes?.nombre}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Monto: <span className="font-semibold text-gray-700">{formatCurrency(confirmDelete.monto_prestado)}</span>. Se eliminarán también los pagos programados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
