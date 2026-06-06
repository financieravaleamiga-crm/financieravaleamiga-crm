import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { formatCurrency, formatDate, getEstatusPago, generarWhatsApp } from '../utils/calculos'
import { calcularPenalizacion, calcularRedito } from '../utils/cobranza'
import { generarEstadoCuenta, generarReciboCobro } from '../utils/pdf'
import { HandCoins, X, MessageCircle, Clock, CheckCircle2, AlertTriangle, RotateCcw, ChevronDown, FileText } from 'lucide-react'

const ESTATUS_COLORS = {
  pagado:     'bg-green-100 text-green-700',
  parcial:    'bg-amber-100 text-amber-700',
  vencido:    'bg-red-100 text-red-600',
  proximo:    'bg-orange-100 text-orange-600',
  pendiente:  'bg-gray-100 text-gray-600',
  postergado: 'bg-purple-100 text-purple-700',
}

// Modos del modal de acción
const MODO = { PAGO: 'pago', PENALIZACION: 'penalizacion', POSTERGAR: 'postergar' }

export default function CobrosPage() {
  const {
    pagos, fetchPagos, registrarPago,
    aplicarPenalizacionPago, postergarPagoProgramado,
    prestamos, loading,
  } = useAppStore()

  const [tab, setTab] = useState('pendientes')
  const [selected, setSelected] = useState(null)
  const [generandoPDF, setGenerandoPDF] = useState(null) // pagoId
  const [modo, setModo] = useState(MODO.PAGO)

  // Pago normal
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')

  // Penalización
  const [tipoPen, setTipoPen] = useState('porcentaje')
  const [valorPen, setValorPen] = useState('')

  // Postergar
  const [tipoRedito, setTipoRedito] = useState('porcentaje')
  const [valorRedito, setValorRedito] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchPagos() }, [])

  const pendientes = pagos.filter(p => !p.pagado)
  const historial  = pagos.filter(p => p.pagado)
  const lista = tab === 'pendientes' ? pendientes : historial

  const getNombrePrestamo = (pago) => pago.prestamos?.clientes?.nombre || '—'

  const handleGenerarPDF = async (pago) => {
    setGenerandoPDF(pago.id)
    try {
      const { supabase } = await import('../lib/supabase')

      // Obtener préstamo completo directo de Supabase
      const { data: prestamo } = await supabase
        .from('prestamos').select('*, clientes(*)')
        .eq('id', pago.prestamo_id).maybeSingle()

      if (!prestamo) { console.error('Préstamo no encontrado'); return }

      const clienteCompleto = prestamo.clientes || {}

      const { data: todosPagos } = await supabase
        .from('pagos_programados').select('*')
        .eq('prestamo_id', pago.prestamo_id)
        .order('fecha_vencimiento', { ascending: true })

      await generarReciboCobro(pago, prestamo, clienteCompleto, todosPagos || [])
    } catch (err) {
      console.error('Error al generar PDF:', err)
    } finally {
      setGenerandoPDF(null)
    }
  }

  const abrirModal = (pago, modoInicial = MODO.PAGO) => {
    setSelected(pago)
    setModo(modoInicial)
    setMonto('')
    setNotas('')
    setTipoPen('porcentaje')
    setValorPen('')
    setTipoRedito('porcentaje')
    setValorRedito('')
    setError('')
    setSuccessMsg('')
  }

  const cerrarModal = () => { setSelected(null); setError(''); setSuccessMsg('') }

  // ─── Pago normal ────────────────────────────────────────────
  const handlePago = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      await registrarPago(selected.id, parseFloat(monto), notas)
      await fetchPagos()
      cerrarModal()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  // ─── Penalización ────────────────────────────────────────────
  const handlePenalizacion = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      await aplicarPenalizacionPago(selected.id, tipoPen, parseFloat(valorPen))
      await fetchPagos()
      setSuccessMsg('Penalización aplicada correctamente.')
      setTimeout(cerrarModal, 1500)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  // ─── Postergar ───────────────────────────────────────────────
  const handlePostergar = async (e) => {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const { montoRedito } = await postergarPagoProgramado(selected.id, tipoRedito, parseFloat(valorRedito))
      await fetchPagos()
      setSuccessMsg(`Postergado. Rédito cobrado: ${formatCurrency(montoRedito)}`)
      setTimeout(cerrarModal, 1800)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  // Preview de cálculos
  const previewPen = selected && valorPen
    ? calcularPenalizacion(parseFloat(selected.saldo_restante ?? selected.monto_programado), tipoPen, parseFloat(valorPen))
    : 0

  const previewRedito = selected && valorRedito
    ? calcularRedito(parseFloat(selected.monto_programado), tipoRedito, parseFloat(valorRedito))
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-brand-600 pt-12 pb-4 px-4">
        <div className="flex items-center gap-2 mb-3">
          <HandCoins size={22} className="text-white" />
          <h1 className="text-white font-black text-xl">Cobros</h1>
        </div>

        <div className="flex bg-white/20 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('pendientes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-bold transition ${
              tab === 'pendientes' ? 'bg-white text-brand-600' : 'text-white/80'
            }`}
          >
            <Clock size={14} />
            Pendientes
            {pendientes.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                tab === 'pendientes' ? 'bg-brand-100 text-brand-700' : 'bg-white/30 text-white'
              }`}>{pendientes.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-bold transition ${
              tab === 'historial' ? 'bg-white text-brand-600' : 'text-white/80'
            }`}
          >
            <CheckCircle2 size={14} />
            Historial
            {historial.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                tab === 'historial' ? 'bg-brand-100 text-brand-700' : 'bg-white/30 text-white'
              }`}>{historial.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 font-medium">
          {lista.length} {tab === 'pendientes' ? 'pagos pendientes' : 'pagos realizados'}
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <HandCoins size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{tab === 'pendientes' ? 'Sin cobros pendientes' : 'Sin pagos registrados'}</p>
          </div>
        ) : (
          lista.map(pago => {
            const estatus = pago.postergado ? 'postergado' : getEstatusPago(pago)
            const cliente = pago.prestamos?.clientes
            const nombreCliente = getNombrePrestamo(pago)
            return (
              <div key={pago.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-800">{nombreCliente}</p>
                    <p className="text-xs text-gray-500 font-medium">Pago #{pago.numero_pago}</p>
                    <p className="text-xs text-gray-400">
                      {tab === 'historial' && pago.fecha_pago
                        ? `Pagado: ${formatDate(pago.fecha_pago)}`
                        : `Vence: ${formatDate(pago.fecha_vencimiento)}`
                      }
                    </p>
                    {pago.quincena_acumulada && (
                      <p className="text-xs text-orange-600 font-semibold mt-0.5">⚠ Quincena acumulada</p>
                    )}
                    {pago.penalizacion_aplicada && (
                      <p className="text-xs text-red-500 font-semibold mt-0.5">
                        🔴 Penalización: {formatCurrency(pago.monto_penalizacion)}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ESTATUS_COLORS[estatus] || ESTATUS_COLORS.pendiente}`}>
                    {estatus}
                  </span>
                </div>

                {/* Desglose si hay acumulación */}
                {pago.detalle_desglose && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 mb-2 text-xs text-orange-700">
                    <strong>Desglose:</strong> {pago.detalle_desglose}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">Monto</p>
                    <p className="font-black text-gray-800">{formatCurrency(pago.saldo_restante ?? pago.monto_programado)}</p>
                    {tab === 'historial' && pago.monto_pagado > 0 && (
                      <p className="text-xs text-green-600 font-semibold">Pagado: {formatCurrency(pago.monto_pagado)}</p>
                    )}
                    {pago.postergado && pago.monto_redito > 0 && (
                      <p className="text-xs text-purple-600 font-semibold">Rédito pagado: {formatCurrency(pago.monto_redito)}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <button
                      onClick={() => handleGenerarPDF(pago)}
                      disabled={generandoPDF === pago.id}
                      className="bg-gray-100 text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 disabled:opacity-60"
                      title="Generar estado de cuenta"
                    >
                      <FileText size={13} />
                      {generandoPDF === pago.id ? '...' : 'EC'}
                    </button>
                    {cliente?.telefono && tab === 'pendientes' && (
                      <a
                        href={generarWhatsApp(cliente.telefono, cliente, pago, pago.prestamos)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-500 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1"
                      >
                        <MessageCircle size={13} />WA
                      </a>
                    )}
                    {tab === 'pendientes' && !pago.pagado && (
                      <>
                        <button
                          onClick={() => abrirModal(pago, MODO.PAGO)}
                          className="bg-brand-600 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold"
                        >
                          Registrar
                        </button>
                        <button
                          onClick={() => abrirModal(pago, MODO.PENALIZACION)}
                          className="bg-red-500 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1"
                          title="Aplicar penalización"
                        >
                          <AlertTriangle size={13} />Pen.
                        </button>
                        <button
                          onClick={() => abrirModal(pago, MODO.POSTERGAR)}
                          className="bg-purple-500 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1"
                          title="Postergar con rédito"
                        >
                          <RotateCcw size={13} />Post.
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {pago.notas && (
                  <p className="text-xs text-gray-400 mt-2 italic">"{pago.notas}"</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ─── Modal unificado ─── */}
      {selected && (() => {
        // Determinar el botón de acción según el modo
        const btnConfig = {
          [MODO.PAGO]:        { form: 'form-pago',        label: saving ? 'Guardando…' : 'Confirmar Pago',        cls: 'bg-brand-600' },
          [MODO.PENALIZACION]:{ form: 'form-penalizacion', label: saving ? 'Aplicando…' : 'Aplicar Penalización',  cls: 'bg-red-500' },
          [MODO.POSTERGAR]:   { form: 'form-postergar',   label: saving ? 'Procesando…' : 'Confirmar Postergación', cls: 'bg-purple-500' },
        }[modo]

        return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white rounded-t-3xl w-full flex flex-col" style={{ maxHeight: '92dvh' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-black text-gray-800">
                {modo === MODO.PAGO && 'Registrar Pago'}
                {modo === MODO.PENALIZACION && 'Aplicar Penalización'}
                {modo === MODO.POSTERGAR && 'Postergar Pago'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400"><X size={22} /></button>
            </div>
            <p className="text-sm text-gray-500 px-5 mb-1">
              {selected.prestamos?.clientes?.nombre || '—'} · Pago #{selected.numero_pago}
            </p>
            <p className="text-xs text-gray-400 px-5 mb-3">
              Saldo: {formatCurrency(selected.saldo_restante ?? selected.monto_programado)} · Vence: {formatDate(selected.fecha_vencimiento)}
            </p>

            {/* Tabs de modo */}
            <div className="flex gap-1.5 px-5 mb-4 shrink-0">
              {[
                { key: MODO.PAGO, label: 'Pago', color: 'brand' },
                { key: MODO.PENALIZACION, label: 'Penalizar', color: 'red' },
                { key: MODO.POSTERGAR, label: 'Postergar', color: 'purple' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => { setModo(key); setError(''); setSuccessMsg('') }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                    modo === key
                      ? color === 'brand' ? 'bg-brand-600 text-white'
                        : color === 'red' ? 'bg-red-500 text-white'
                        : 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Contenido scrollable — sin el botón de submit */}
            <div className="overflow-y-auto px-5 pb-3 space-y-3 flex-1">
              {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2 font-semibold">{successMsg}</div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
              )}

              {/* ── PAGO NORMAL ── */}
              {modo === MODO.PAGO && (
                <form id="form-pago" onSubmit={handlePago} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Monto a registrar *</label>
                    <input
                      type="number" required min="0.01" step="0.01"
                      value={monto} onChange={e => setMonto(e.target.value)}
                      placeholder={formatCurrency(selected.saldo_restante ?? selected.monto_programado)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                    <input
                      type="text" value={notas} onChange={e => setNotas(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </form>
              )}

              {/* ── PENALIZACIÓN ── */}
              {modo === MODO.PENALIZACION && (
                <form id="form-penalizacion" onSubmit={handlePenalizacion} className="space-y-3">
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
                    La penalización se suma al saldo pendiente de este pago.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de penalización</label>
                    <div className="flex gap-2">
                      {['porcentaje', 'fijo'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setTipoPen(t)}
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
                    <input
                      type="number" required min="0.01" step="0.01"
                      value={valorPen} onChange={e => setValorPen(e.target.value)}
                      placeholder={tipoPen === 'porcentaje' ? 'Ej: 20' : 'Ej: 100'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  {previewPen > 0 && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Saldo actual</span>
                        <span>{formatCurrency(selected.saldo_restante ?? selected.monto_programado)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>+ Penalización</span>
                        <span>{formatCurrency(previewPen)}</span>
                      </div>
                      <div className="flex justify-between text-gray-800 font-black border-t pt-1 mt-1">
                        <span>Nuevo saldo</span>
                        <span>{formatCurrency((parseFloat(selected.saldo_restante ?? selected.monto_programado)) + previewPen)}</span>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* ── POSTERGAR ── */}
              {modo === MODO.POSTERGAR && (
                <form id="form-postergar" onSubmit={handlePostergar} className="space-y-3">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-purple-700">
                    El cliente paga solo el rédito. La quincena se mueve al siguiente periodo y se acumula con la próxima.
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de rédito</label>
                    <div className="flex gap-2">
                      {['porcentaje', 'fijo'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setTipoRedito(t)}
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
                    <input
                      type="number" required min="0.01" step="0.01"
                      value={valorRedito} onChange={e => setValorRedito(e.target.value)}
                      placeholder={tipoRedito === 'porcentaje' ? 'Ej: 15' : 'Ej: 75'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  {previewRedito > 0 && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Quincena normal</span>
                        <span>{formatCurrency(selected.monto_programado)}</span>
                      </div>
                      <div className="flex justify-between text-purple-600 font-semibold">
                        <span>Cliente paga (rédito)</span>
                        <span>{formatCurrency(previewRedito)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600 font-semibold border-t pt-1 mt-1">
                        <span>Siguiente cobro incluirá</span>
                        <span>+ {formatCurrency(parseFloat(selected.monto_programado))}</span>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Botón de acción — FIJO en la parte inferior, siempre visible */}
            {!successMsg && (
              <div className="shrink-0 px-5 pt-3 pb-6 border-t border-gray-100 bg-white">
                <button
                  type="submit"
                  form={btnConfig.form}
                  disabled={saving}
                  className={`w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-60 ${btnConfig.cls}`}
                >
                  {btnConfig.label}
                </button>
              </div>
            )}
          </div>
        </div>
        )
      })()}
    </div>
  )
}
