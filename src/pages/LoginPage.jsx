import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #00211a 0%, #003d2b 50%, #005c40 100%)' }}>

      {/* Logo principal — sin caja, directo sobre fondo verde */}
      <div className="flex flex-col items-center mb-10">
        <img
          src="https://i.postimg.cc/Qx4yMXqx/logo-horizontal.png"
          alt="PRESTAAPP"
          className="h-16 w-auto object-contain"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'block'
          }}
        />
        <span className="hidden text-3xl font-black text-white">PRESTAAPP</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Iniciar Sesión</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
              style={{ '--tw-ring-color': '#00D886' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-lg"
            style={{ background: loading ? '#00bd74' : '#00D886' }}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Entrar
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer créditos */}
      <div className="mt-10 flex flex-col items-center gap-2 opacity-60">
        <span className="text-white/50 text-[10px] font-medium tracking-widest uppercase">Desarrollado por</span>
        <a href="https://teers.mx" target="_blank" rel="noopener noreferrer">
          <img
            src="https://i.postimg.cc/DyM3vKyr/logo-teers-nuevo1.png"
            alt="Teers"
            className="h-5 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
          />
        </a>
      </div>
    </div>
  )
}
