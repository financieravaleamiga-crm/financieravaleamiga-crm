import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { Settings, LogOut, User, Building2, CreditCard, Save, Check } from 'lucide-react'

const EMPTY_EMPRESA = {
  nombre_empresa: '', nombre_comercial: '', telefono: '',
  correo: '', direccion: '', ciudad: '', estado: '', observaciones: '',
}
const EMPTY_BANCO = {
  banco: '', titular: '', num_cuenta: '', clabe: '', tarjeta: '', observaciones: '',
}

function Campo({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-gray-50"
      />
    </div>
  )
}

function CampoArea({ label, value, onChange, placeholder = '' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-gray-50 resize-none"
      />
    </div>
  )
}

export default function ConfigPage() {
  const { user, signOut } = useAuthStore()

  const [empresa,       setEmpresa]       = useState(EMPTY_EMPRESA)
  const [banco,         setBanco]         = useState(EMPTY_BANCO)
  const [loadingData,   setLoadingData]   = useState(true)
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [savingBanco,   setSavingBanco]   = useState(false)
  const [okEmpresa,     setOkEmpresa]     = useState(false)
  const [okBanco,       setOkBanco]       = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)

  // Cargar datos existentes
  useEffect(() => {
    if (!user) return
    async function cargar() {
      setLoadingData(true)
      const [{ data: e }, { data: b }] = await Promise.all([
        supabase.from('empresa_config').select('*').eq('user_id', user.id).single(),
        supabase.from('datos_bancarios').select('*').eq('user_id', user.id).single(),
      ])
      if (e) setEmpresa({ ...EMPTY_EMPRESA, ...e })
      if (b) setBanco({ ...EMPTY_BANCO, ...b })
      setLoadingData(false)
    }
    cargar()
  }, [user])

  const handleGuardarEmpresa = async () => {
    setSavingEmpresa(true)
    const payload = { ...empresa, user_id: user.id }
    await supabase.from('empresa_config').upsert(payload, { onConflict: 'user_id' })
    setSavingEmpresa(false)
    setOkEmpresa(true)
    setTimeout(() => setOkEmpresa(false), 2500)
  }

  const handleGuardarBanco = async () => {
    setSavingBanco(true)
    const payload = { ...banco, user_id: user.id }
    await supabase.from('datos_bancarios').upsert(payload, { onConflict: 'user_id' })
    setSavingBanco(false)
    setOkBanco(true)
    setTimeout(() => setOkBanco(false), 2500)
  }

  const handleSignOut = async () => {
    setSignOutLoading(true)
    await signOut()
  }

  const setE = (key) => (val) => setEmpresa(prev => ({ ...prev, [key]: val }))
  const setB = (key) => (val) => setBanco(prev => ({ ...prev, [key]: val }))

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-brand-600 pt-12 pb-4 px-4">
        <div className="flex items-center gap-2">
          <Settings size={22} className="text-white" />
          <h1 className="text-white font-black text-xl">Configuracion</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* Usuario */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 text-brand-600 p-2.5 rounded-xl">
              <User size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 font-medium">Usuario activo</p>
              <p className="text-sm font-bold text-gray-800 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── Datos de la empresa ─────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                  <Building2 size={18} />
                </div>
                <h2 className="font-black text-gray-800 text-base">Datos de la empresa</h2>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Nombre de la empresa"
                    value={empresa.nombre_empresa}
                    onChange={setE('nombre_empresa')}
                    placeholder="Razón social"
                  />
                  <Campo
                    label="Nombre comercial"
                    value={empresa.nombre_comercial}
                    onChange={setE('nombre_comercial')}
                    placeholder="Nombre visible"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Telefono"
                    value={empresa.telefono}
                    onChange={setE('telefono')}
                    placeholder="55 0000 0000"
                    type="tel"
                  />
                  <Campo
                    label="Correo"
                    value={empresa.correo}
                    onChange={setE('correo')}
                    placeholder="contacto@empresa.com"
                    type="email"
                  />
                </div>
                <Campo
                  label="Direccion"
                  value={empresa.direccion}
                  onChange={setE('direccion')}
                  placeholder="Calle y número, colonia"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Ciudad"
                    value={empresa.ciudad}
                    onChange={setE('ciudad')}
                    placeholder="Ciudad"
                  />
                  <Campo
                    label="Estado"
                    value={empresa.estado}
                    onChange={setE('estado')}
                    placeholder="Estado"
                  />
                </div>
                <CampoArea
                  label="Observaciones"
                  value={empresa.observaciones}
                  onChange={setE('observaciones')}
                  placeholder="Notas adicionales de la empresa..."
                />
              </div>

              <button
                onClick={handleGuardarEmpresa}
                disabled={savingEmpresa}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60 transition-all"
              >
                {okEmpresa
                  ? <><Check size={16} /> Guardado</>
                  : savingEmpresa
                    ? 'Guardando...'
                    : <><Save size={16} /> Guardar datos de empresa</>
                }
              </button>
            </div>

            {/* ── Datos bancarios ─────────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-green-50 text-green-600 p-2 rounded-xl">
                  <CreditCard size={18} />
                </div>
                <h2 className="font-black text-gray-800 text-base">Datos bancarios</h2>
              </div>
              <p className="text-xs text-gray-400 mb-3">Esta informacion aparece al final del estado de cuenta para que el cliente sepa donde depositar.</p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Banco"
                    value={banco.banco}
                    onChange={setB('banco')}
                    placeholder="BBVA, Banamex..."
                  />
                  <Campo
                    label="Titular"
                    value={banco.titular}
                    onChange={setB('titular')}
                    placeholder="Nombre del titular"
                  />
                </div>
                <Campo
                  label="Numero de cuenta"
                  value={banco.num_cuenta}
                  onChange={setB('num_cuenta')}
                  placeholder="0000000000"
                />
                <Campo
                  label="CLABE interbancaria"
                  value={banco.clabe}
                  onChange={setB('clabe')}
                  placeholder="18 digitos"
                />
                <Campo
                  label="Numero de tarjeta"
                  value={banco.tarjeta}
                  onChange={setB('tarjeta')}
                  placeholder="0000 0000 0000 0000"
                />
                <CampoArea
                  label="Instrucciones / Observaciones"
                  value={banco.observaciones}
                  onChange={setB('observaciones')}
                  placeholder="Ej: Incluir nombre del cliente en referencia..."
                />
              </div>

              <button
                onClick={handleGuardarBanco}
                disabled={savingBanco}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60 transition-all"
              >
                {okBanco
                  ? <><Check size={16} /> Guardado</>
                  : savingBanco
                    ? 'Guardando...'
                    : <><Save size={16} /> Guardar datos bancarios</>
                }
              </button>
            </div>
          </>
        )}

        {/* Cerrar sesión */}
        <button
          onClick={handleSignOut}
          disabled={signOutLoading}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          <div className="bg-red-50 text-red-500 p-2.5 rounded-xl">
            <LogOut size={20} />
          </div>
          <span className="font-bold">{signOutLoading ? 'Cerrando sesion...' : 'Cerrar Sesion'}</span>
        </button>
      </div>
    </div>
  )
}
