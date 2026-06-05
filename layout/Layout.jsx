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
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
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
                  ? 'text-brand-600'
                  : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-brand-50' : ''}`}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                  <span className={`text-[9px] font-semibold ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
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
