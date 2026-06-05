import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { History, Search, X, RefreshCw } from 'lucide-react'

// ─── Configuración visual por tipo de movimiento ─────────────
const TIPO_CONFIG = {
  CREACION_CLIENTE:     { label: 'Cliente creado',    color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  ACTUALIZACION_CLIENTE:{ label: 'Cliente editado',   color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  ELIMINACION_CLIENTE:  { label: 'Cliente eliminado', color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
  CREACION_PRESTAMO:    { label: 'Préstamo creado',   color: 'bg-brand-100 text-brand-700', dot: 'bg-brand-600' },
  EDICION_PRESTAMO:     { label: 'Préstamo editado',  color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ELIMINACION_PRESTAMO: { label: 'Préstamo eliminado',color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
  PAGO_COMPLETO:        { label: 'Pago completo',     color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  PAGO_PARCIAL:         { label: 'Pago parcial',      color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  PAGO_DESDE_PRESTAMO:  { label: 'Pago (Préstamos)',  color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  LIQUIDACION_CREDITO:  { label: 'Liquidación',       color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  PENALIZACION_APLICADA:{ label: 'Penalización',      color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
  POSTERGACION:         { label: 'Postergación',      color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  PAGO_REDITO:          { label: 'Rédito pagado',     color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
}

const FILTROS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'pagos',      label: 'Pagos' },
  { key: 'prestamos',  label: 'Préstamos' },
  { key: 'clientes',   label: 'Clientes' },
]

const GRUPOS_FILTRO = {
  pagos:     ['PAGO_COMPLETO', 'PAGO_PARCIAL', 'PAGO_DESDE_PRESTAMO', 'LIQUIDACION_CREDITO', 'PENALIZACION_APLICADA', 'POSTERGACION', 'PAGO_REDITO'],
  prestamos: ['CREACION_PRESTAMO', 'EDICION_PRESTAMO', 'ELIMINACION_PRESTAMO'],
  clientes:  ['CREACION_CLIENTE', 'ACTUALIZACION_CLIENTE', 'ELIMINACION_CLIENTE'],
}

function formatFecha(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatMoneda(monto) {
  if (monto == null) return null
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}

// Agrupa movimientos por fecha (día)
function agruparPorDia(movimientos) {
  const grupos = {}
  movimientos.forEach(m => {
    const dia = new Date(m.fecha_movimiento).toLocaleDateString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    })
    if (!grupos[dia]) grupos[dia] = []
    grupos[dia].push(m)
  })
  return grupos
}

export default function HistorialPage() {
  const { historial, fetchHistorial, loading } = useAppStore()
  const [search, setSearch]   = useState('')
  const [filtro, setFiltro]   = useState('todos')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchHistorial() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchHistorial()
    setRefreshing(false)
  }

  // Aplicar filtro de categoría + búsqueda
  const filtrado = historial.filter(m => {
    const matchFiltro = filtro === 'todos'
      ? true
      : (GRUPOS_FILTRO[filtro] || []).includes(m.tipo_movimiento)

    const q = search.toLowerCase()
    const matchSearch = !q
      ? true
      : (m.descripcion || '').toLowerCase().includes(q) ||
        (m.clientes?.nombre || '').toLowerCase().includes(q) ||
        m.tipo_movimiento.toLowerCase().includes(q)

    return matchFiltro && matchSearch
  })

  const grupos = agruparPorDia(filtrado)
  const totalMonto = filtrado
    .filter(m => m.monto != null && ['PAGO_COMPLETO','PAGO_PARCIAL','PAGO_DESDE_PRESTAMO','PAGO_REDITO'].includes(m.tipo_movimiento))
    .reduce((acc, m) => acc + parseFloat(m.monto), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-600 pt-12 pb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History size={22} className="text-white" />
            <h1 className="text-white font-black text-xl">Historial</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="bg-white/20 text-white rounded-xl p-2 disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw size={16} className={refreshing || loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none shadow"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filtros de categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filtro === f.key
                  ? 'bg-white text-brand-600'
                  : 'bg-white/20 text-white/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Movimientos filtrados</p>
            <p className="text-lg font-black text-gray-800">{filtrado.length}</p>
          </div>
          {totalMonto > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Cobrado (filtro)</p>
              <p className="text-lg font-black text-green-600">{formatMoneda(totalMonto)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista agrupada por día */}
      <div className="p-4 space-y-4">
        {loading && !refreshing ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <History size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin movimientos registrados</p>
            {search && <p className="text-xs mt-1">Prueba otra búsqueda</p>}
          </div>
        ) : (
          Object.entries(grupos).map(([dia, movs]) => (
            <div key={dia}>
              {/* Encabezado del día */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400 font-semibold capitalize shrink-0">{dia}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-2">
                {movs.map(m => {
                  const cfg = TIPO_CONFIG[m.tipo_movimiento] || {
                    label: m.tipo_movimiento,
                    color: 'bg-gray-100 text-gray-600',
                    dot: 'bg-gray-400',
                  }
                  return (
                    <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        {/* Dot + tipo */}
                        <div className="flex items-start gap-2 min-w-0">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              {m.clientes?.nombre && (
                                <span className="text-xs text-gray-500 font-semibold truncate max-w-[140px]">
                                  {m.clientes.nombre}
                                </span>
                              )}
                            </div>
                            {m.descripcion && (
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                {m.descripcion}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-300 mt-1">
                              {formatFecha(m.fecha_movimiento)}
                            </p>
                          </div>
                        </div>

                        {/* Monto */}
                        {m.monto != null && (
                          <p className={`text-sm font-black shrink-0 ${
                            ['PAGO_COMPLETO','PAGO_PARCIAL','PAGO_DESDE_PRESTAMO','PAGO_REDITO'].includes(m.tipo_movimiento)
                              ? 'text-green-600'
                              : 'text-gray-700'
                          }`}>
                            {formatMoneda(m.monto)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
