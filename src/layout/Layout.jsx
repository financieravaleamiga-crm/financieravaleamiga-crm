import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Banknote, HandCoins, History, Settings } from 'lucide-react'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Inicio' },
  { to: '/clientes',   icon: Users,           label: 'Clientes' },
  { to: '/prestamos',  icon: Banknote,        label: 'Préstamos' },
  { to: '/cobros',     icon: HandCoins,       label: 'Cobros' },
  { to: '/historial',  icon: History,         label: 'Historial' },
  { to: '/config',     icon: Settings,        label: 'Config' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />

        {/* Footer créditos */}
        <div className="flex flex-col items-center gap-1.5 py-6 mt-4 border-t border-gray-100">
          <span className="text-[9px] font-medium tracking-widest uppercase text-gray-400">Desarrollado por</span>
          <a href="https://teers.mx" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-80 transition-opacity">
            <img
              src="https://i.postimg.cc/DyM3vKyr/logo-teers-nuevo1.png"
              alt="Teers"
              className="h-4 w-auto object-contain"
            />
          </a>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
        <div className="flex">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                ${isActive
                  ? 'text-brand-500'
                  : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-brand-50' : ''}`}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                  <span className={`text-[9px] font-semibold ${isActive ? 'text-brand-500' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
