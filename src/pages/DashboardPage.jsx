import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import {
  calcularResumen,
  formatCurrency,
  formatDateShort,
  generarWhatsApp,
} from '../utils/calculos'
import {
  AlertTriangle, Clock, CalendarCheck, ArrowRight,
  MessageCircle, Wallet, Users, TrendingUp,
  Banknote, CheckCircle2, ShieldAlert, RefreshCw,
  LogOut, ChevronRight, Zap, Calendar,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function hoyStr() {
  return new Date().toISOString().split('T')[0]
}

function en7DiasStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function calcularIndicadores(pagos, historial) {
  const totalPenalizaciones = pagos.reduce(
    (s, p) => s + parseFloat(p.monto_penalizacion || 0), 0
  )
  const totalReditos = pagos.reduce(
    (s, p) => s + parseFloat(p.monto_redito || 0), 0
  )
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioMesStr = inicioMes.toISOString().split('T')[0]
  const pagosMes = pagos.filter(
    p => p.pagado && p.fecha_pago && p.fecha_pago >= inicioMesStr
  )
  const totalPagosMes = pagosMes.reduce(
    (s, p) => s + parseFloat(p.monto_pagado || 0), 0
  )
  return { totalPenalizaciones, totalReditos, totalPagosMes }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PulseRing({ color = '#ef4444' }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

function AccionCard({ label, count, monto, color, icon: Icon, pulse, onVer }) {
  const styles = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      badge: 'bg-red-500',
      btn: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
      iconBg: 'bg-red-100',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      badge: 'bg-amber-500',
      btn: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
      iconBg: 'bg-amber-100',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      badge: 'bg-blue-500',
      btn: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
      iconBg: 'bg-blue-100',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      badge: 'bg-purple-500',
      btn: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
      iconBg: 'bg-purple-100',
    },
  }
  const s = styles[color]
  return (
    <div className={`rounded-2xl border p-4 ${s.bg} ${s.border} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl ${s.iconBg}`}>
          <Icon size={18} className={s.text} />
        </div>
        {pulse && count > 0 && (
          <PulseRing color={color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#3b82f6'} />
        )}
      </div>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${s.text} opacity-70`}>{label}</p>
        <p className={`text-3xl font-black ${s.text} leading-none mt-0.5`}>{count}</p>
        <p className="text-xs text-gray-500 font-medium mt-1">{formatCurrency(monto)}</p>
      </div>
      <button
        onClick={onVer}
        className={`w-full py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${s.btn}`}
      >
        Ver <ChevronRight size={14} />
      </button>
    </div>
  )
}

function ClienteRow({ pago, onWhatsApp, onVerPrestamo }) {
  const cliente = pago.prestamos?.clientes
  const nombre = cliente?.nombre || '—'
  const telefono = cliente?.telefono || ''
  const hoy = hoyStr()

  let estadoLabel = 'Próximo'
  let estadoClass = 'bg-blue-100 text-blue-700'
  if (pago.estatus === 'postergado') {
    estadoLabel = 'Postergado'
    estadoClass = 'bg-purple-100 text-purple-700'
  } else if (pago.fecha_vencimiento < hoy) {
    estadoLabel = 'Vencido'
    estadoClass = 'bg-red-100 text-red-700'
  } else if (pago.fecha_vencimiento === hoy) {
    estadoLabel = 'Hoy'
    estadoClass = 'bg-amber-100 text-amber-700'
  }

  const waLink = cliente && telefono
    ? generarWhatsApp(telefono, cliente, pago, pago.prestamos)
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-tight truncate">{nombre}</p>
          <p className="text-xs text-gray-400 mt-0.5">{telefono}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${estadoClass}`}>
          {estadoLabel}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-black text-gray-800">{formatCurrency(pago.saldo_restante ?? pago.monto_programado)}</p>
          <p className="text-xs text-gray-400">{formatDateShort(pago.fecha_vencimiento)}</p>
        </div>
        <div className="flex gap-2">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-all"
            >
              <MessageCircle size={14} />
              WA
            </a>
          )}
          <button
            onClick={() => onVerPrestamo(pago.prestamo_id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold active:scale-95 transition-all"
          >
            Ver <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CobranzaRapidaRow({ pago, index, onVerPrestamo }) {
  const cliente = pago.prestamos?.clientes
  const nombre = cliente?.nombre || '—'
  const hoy = hoyStr()
  let dot = 'bg-blue-400'
  if (pago.fecha_vencimiento < hoy) dot = 'bg-red-500'
  else if (pago.fecha_vencimiento === hoy) dot = 'bg-amber-500'

  return (
    <button
      onClick={() => onVerPrestamo(pago.prestamo_id)}
      className="flex items-center gap-3 w-full text-left py-3.5 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors"
    >
      <span className="text-xs font-black text-gray-300 w-5 shrink-0 text-center">#{index + 1}</span>
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{nombre}</p>
        <p className="text-xs text-gray-400">{formatDateShort(pago.fecha_vencimiento)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-black text-gray-900 text-sm">{formatCurrency(pago.saldo_restante ?? pago.monto_programado)}</p>
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </button>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { prestamos, pagos, clientes, historial, fetchPrestamos, fetchPagos, fetchClientes, loading } = useAppStore()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchPrestamos()
    fetchPagos()
    fetchClientes()
  }, [])

  const resumen = useMemo(() => calcularResumen(prestamos, pagos), [prestamos, pagos])
  const indicadores = useMemo(() => calcularIndicadores(pagos, historial), [pagos, historial])

  const hoy = hoyStr()
  const en7 = en7DiasStr()

  // Secciones de acciones del día
  const vencidos = useMemo(() =>
    pagos.filter(p => !p.pagado && p.fecha_vencimiento < hoy && p.estatus !== 'postergado'),
    [pagos, hoy]
  )
  const vencenHoy = useMemo(() =>
    pagos.filter(p => !p.pagado && p.fecha_vencimiento === hoy),
    [pagos, hoy]
  )
  const proximos7 = useMemo(() =>
    pagos.filter(p => !p.pagado && p.fecha_vencimiento > hoy && p.fecha_vencimiento <= en7),
    [pagos, hoy, en7]
  )
  const postergados = useMemo(() =>
    pagos.filter(p => p.estatus === 'postergado'),
    [pagos]
  )

  // Lista de trabajo priorizada
  const listaTrabajoRaw = useMemo(() => {
    const venc = vencidos.map(p => ({ ...p, _prioridad: 0 }))
    const hoyPagos = vencenHoy.map(p => ({ ...p, _prioridad: 1 }))
    const prox = proximos7.map(p => ({ ...p, _prioridad: 2 }))
    return [...venc, ...hoyPagos, ...prox]
  }, [vencidos, vencenHoy, proximos7])

  // Cobranza rápida: primeros 8 pendientes (vencidos + hoy primero)
  const cobranzaRapida = useMemo(() =>
    listaTrabajoRaw.slice(0, 8),
    [listaTrabajoRaw]
  )

  // Totales para acciones
  const montoVencidos = vencidos.reduce((s, p) => s + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0), 0)
  const montoHoy = vencenHoy.reduce((s, p) => s + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0), 0)
  const montoProximos = proximos7.reduce((s, p) => s + parseFloat(p.monto_programado ?? 0), 0)
  const montoPostergados = postergados.reduce((s, p) => s + parseFloat(p.saldo_restante ?? p.monto_programado ?? 0), 0)

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchPrestamos(), fetchPagos(), fetchClientes()])
    setRefreshing(false)
  }

  function irACobros() {
    navigate('/cobros')
  }

  function irAPrestamo(id) {
    navigate(`/prestamos`)
    // Store to filter could be extended; for now navigate to prestamos
  }

  const clientesActivos = useMemo(() =>
    clientes.filter(c => prestamos.some(p => p.cliente_id === c.id && p.estatus === 'activo')).length,
    [clientes, prestamos]
  )

  const prestamosLiquidadosMes = useMemo(() => {
    const hoyD = new Date()
    const inicioMes = new Date(hoyD.getFullYear(), hoyD.getMonth(), 1)
    return prestamos.filter(p => {
      if (p.estatus !== 'liquidado') return false
      // No tenemos fecha_liquidacion, usamos created_at aproximado — mostramos total
      return true
    }).length
  }, [prestamos])

  if (loading && pagos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm text-gray-400 font-medium">Cargando datos…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div
        className="relative pt-12 pb-8 px-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #003d2b 0%, #00211a 100%)' }}
      >
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="absolute top-4 -right-6 w-24 h-24 rounded-full opacity-10" style={{ background: '#00D886' }} />

        <div className="flex items-center justify-between mb-5 relative z-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#00D886', opacity: 0.8 }}>Panel de trabajo</p>
            <img
              src="https://i.postimg.cc/Qx4yMXqx/logo-horizontal.png"
              alt="PRESTAAPP"
              className="h-8 w-auto object-contain mt-1"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <span className="hidden text-white font-black text-2xl leading-tight">PRESTAAPP</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="hover:text-white p-2 transition active:scale-90"
              style={{ color: '#00D886', opacity: 0.8 }}
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={signOut}
              className="hover:text-white p-2 transition active:scale-90"
              style={{ color: '#00D886', opacity: 0.8 }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Capital hero card */}
        <div className="relative z-10 rounded-2xl p-4 mb-3" style={{ background: 'rgba(0,216,134,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,216,134,0.25)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#00D886', opacity: 0.85 }}>Saldo pendiente total</p>
          <p className="text-white text-4xl font-black leading-none mt-1">
            {formatCurrency(resumen.totalPendiente)}
          </p>
          <div className="flex gap-6 mt-3 pt-3 border-t border-white/20">
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: '#00D886', opacity: 0.7 }}>Prestado</p>
              <p className="text-white text-sm font-bold">{formatCurrency(resumen.totalPrestado)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: '#00D886', opacity: 0.7 }}>Recuperado</p>
              <p className="text-white text-sm font-bold">{formatCurrency(resumen.totalRecuperado)}</p>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-2 relative z-10">
          <div className="flex-1 rounded-xl py-2.5 px-3 text-center" style={{ background: 'rgba(0,216,134,0.10)' }}>
            <p className="text-white text-xl font-black leading-none">{clientesActivos}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#00D886', opacity: 0.75 }}>Clientes activos</p>
          </div>
          <div className="flex-1 rounded-xl py-2.5 px-3 text-center" style={{ background: 'rgba(0,216,134,0.10)' }}>
            <p className="text-white text-xl font-black leading-none">{resumen.prestamosActivos}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#00D886', opacity: 0.75 }}>Préstamos activos</p>
          </div>
          <div className="flex-1 rounded-xl py-2.5 px-3 text-center" style={{ background: 'rgba(0,216,134,0.10)' }}>
            <p className="text-white text-xl font-black leading-none">{resumen.prestamosLiquidados}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#00D886', opacity: 0.75 }}>Liquidados</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6 mt-4">

        {/* ── ACCIONES DEL DÍA ─────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-amber-500" />
            <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Acciones del día</h2>
            {(vencidos.length > 0 || vencenHoy.length > 0) && (
              <PulseRing color="#ef4444" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AccionCard
              label="Vencidos"
              count={vencidos.length}
              monto={montoVencidos}
              color="red"
              icon={AlertTriangle}
              pulse
              onVer={irACobros}
            />
            <AccionCard
              label="Vencen hoy"
              count={vencenHoy.length}
              monto={montoHoy}
              color="amber"
              icon={CalendarCheck}
              pulse
              onVer={irACobros}
            />
            <AccionCard
              label="Próximos 7 días"
              count={proximos7.length}
              monto={montoProximos}
              color="blue"
              icon={Calendar}
              onVer={irACobros}
            />
            <AccionCard
              label="Postergados"
              count={postergados.length}
              monto={montoPostergados}
              color="purple"
              icon={Clock}
              onVer={irACobros}
            />
          </div>
        </section>

        {/* ── COBRANZA RÁPIDA ───────────────────────────────────── */}
        {cobranzaRapida.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-brand-500" />
                <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Cobranza rápida</h2>
              </div>
              <button
                onClick={irACobros}
                className="text-xs font-bold text-brand-600 flex items-center gap-0.5"
              >
                Ver todo <ChevronRight size={12} />
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-1">
              {cobranzaRapida.map((pago, i) => (
                <CobranzaRapidaRow
                  key={pago.id}
                  pago={pago}
                  index={i}
                  onVerPrestamo={irAPrestamo}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── LISTA DE TRABAJO ──────────────────────────────────── */}
        {listaTrabajoRaw.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-gray-500" />
                <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Clientes prioritarios</h2>
              </div>
              <span className="text-xs text-gray-400 font-medium">{listaTrabajoRaw.length} pendientes</span>
            </div>
            <div className="space-y-3">
              {listaTrabajoRaw.slice(0, 15).map(pago => (
                <ClienteRow
                  key={pago.id}
                  pago={pago}
                  onWhatsApp={() => {}}
                  onVerPrestamo={irAPrestamo}
                />
              ))}
              {listaTrabajoRaw.length > 15 && (
                <button
                  onClick={irACobros}
                  className="w-full py-3.5 rounded-2xl border border-dashed border-gray-300 text-sm font-bold text-gray-500 flex items-center justify-center gap-2 active:bg-gray-50 transition-colors"
                >
                  Ver {listaTrabajoRaw.length - 15} más <ChevronRight size={14} />
                </button>
              )}
            </div>
          </section>
        )}

        {listaTrabajoRaw.length === 0 && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="font-black text-green-700 text-base">¡Todo al día!</p>
            <p className="text-xs text-green-600">No hay pagos vencidos ni próximos a vencer.</p>
          </div>
        )}

        {/* ── INDICADORES ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-gray-500" />
            <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Indicadores</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="bg-red-50 w-8 h-8 rounded-xl flex items-center justify-center mb-2">
                <ShieldAlert size={15} className="text-red-500" />
              </div>
              <p className="text-xs text-gray-400 font-semibold">Penalizaciones cobradas</p>
              <p className="text-lg font-black text-gray-800 mt-0.5">{formatCurrency(indicadores.totalPenalizaciones)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="bg-purple-50 w-8 h-8 rounded-xl flex items-center justify-center mb-2">
                <RefreshCw size={15} className="text-purple-500" />
              </div>
              <p className="text-xs text-gray-400 font-semibold">Réditos cobrados</p>
              <p className="text-lg font-black text-gray-800 mt-0.5">{formatCurrency(indicadores.totalReditos)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="bg-green-50 w-8 h-8 rounded-xl flex items-center justify-center mb-2">
                <Wallet size={15} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-400 font-semibold">Pagos del mes</p>
              <p className="text-lg font-black text-gray-800 mt-0.5">{formatCurrency(indicadores.totalPagosMes)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="bg-blue-50 w-8 h-8 rounded-xl flex items-center justify-center mb-2">
                <CheckCircle2 size={15} className="text-blue-500" />
              </div>
              <p className="text-xs text-gray-400 font-semibold">Préstamos liquidados</p>
              <p className="text-lg font-black text-gray-800 mt-0.5">{resumen.prestamosLiquidados}</p>
            </div>
          </div>
        </section>

        {/* ── ACCESOS RÁPIDOS ───────────────────────────────────── */}
        <section className="pb-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/cobros')}
              className="bg-brand-600 text-white rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-all shadow-sm"
            >
              <div className="bg-white/20 p-2 rounded-xl">
                <Banknote size={18} />
              </div>
              <span className="font-bold text-sm">Ir a Cobros</span>
            </button>
            <button
              onClick={() => navigate('/prestamos')}
              className="bg-gray-800 text-white rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-all shadow-sm"
            >
              <div className="bg-white/20 p-2 rounded-xl">
                <TrendingUp size={18} />
              </div>
              <span className="font-bold text-sm">Préstamos</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
