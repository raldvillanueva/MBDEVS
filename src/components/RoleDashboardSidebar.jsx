import { NavLink } from 'react-router-dom'
import { FlaskConical, LayoutGrid } from 'lucide-react'
import logo from '../assets/mb-logo.jpg'
import { ROLE_DASHBOARDS, ROLE_ORDER } from '../data/roleDashboards'

// Standalone sidebar for /preview/* routes only. Deliberately does not use
// useAuth() or useSector() — these pages are not wired to login yet.
export default function RoleDashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 flex min-h-screen w-64 flex-col bg-[#2E2E2E] text-white shadow-xl">
      <div className="h-2 bg-[#D89B00]" />

      <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#2E2E2E]">
        <FlaskConical size={14} />
        Not Yet Behind Login
      </div>

      <div className="flex flex-col items-center border-b border-[#444] px-6 py-6">
        <img
          src={logo}
          alt="MB Development"
          className="mb-4 h-20 w-20 rounded-xl object-cover shadow-lg"
        />
        <h1 className="text-center text-lg font-bold tracking-wide">
          Field Order Management
        </h1>
        <p className="mt-1 text-center text-xs text-gray-400">
          Role Landing Pages
        </p>
      </div>

      <nav className="flex-1 px-4 py-5">
        <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <LayoutGrid size={13} />
          Roles
        </div>
        <div className="space-y-2">
          {ROLE_ORDER.map((key) => (
            <NavLink
              key={key}
              to={`/${key}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#D89B00] text-white shadow-md'
                    : 'text-gray-300 hover:bg-[#3C3C3C] hover:text-white'
                }`
              }
            >
              <span className="flex-1">{ROLE_DASHBOARDS[key].label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-[#444] px-5 py-4">
        <p className="text-[11px] text-gray-500">
          These pages are not connected to login or Supabase auth. No
          accounts are tied to these roles yet.
        </p>
      </div>
    </aside>
  )
}
