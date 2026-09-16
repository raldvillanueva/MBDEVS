import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, ShieldAlert, Settings, ArrowLeft, Users, LogOut } from 'lucide-react'
import logo from '../../assets/mb-logo.jpg'
import { useAuth } from '../../lib/AuthContext'
import { useSector } from '../../lib/SectorContext'
import { supabase } from '../../lib/supabase'

const NAV_ITEMS = [
  { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/super-admin/manage-users', icon: Users, label: 'Manage Users' },
  { to: '/super-admin/records', icon: FileText, label: 'View Records' },
  { to: '/super-admin/audit-logs', icon: ShieldAlert, label: 'Audit Logs' },
  { to: '/super-admin/settings', icon: Settings, label: 'System Settings' },
]

// Dedicated nav for the Super Admin section. Every item here points at a
// page that lives under src/pages/superadmin/ — nothing here hands off to
// the shared role-preview template, the generic "coming soon" page, or the
// login-gated app. Landing on /super-admin is meant to feel like the real,
// standalone Super Admin section.
export default function SuperAdminLayout({ children }) {
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const { clearSector } = useSector()

  async function handleSignOut() {
    clearSector()
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[#F4F4F4]">
      <aside className="fixed left-0 top-0 z-30 flex min-h-screen w-64 flex-col bg-[#2E2E2E] text-white shadow-xl">
        <div className="h-2 bg-[#D89B00]" />

        <div className="flex flex-col items-center border-b border-[#444] px-6 py-6">
          <img
            src={logo}
            alt="MB Development"
            className="mb-4 h-20 w-20 rounded-xl object-cover shadow-lg"
          />
          <h1 className="text-center text-lg font-bold tracking-wide">
            Field Order Management
          </h1>
          <span className="mt-2 rounded-full bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Super Admin
          </span>
        </div>

        <nav className="flex-1 px-4 py-5">
          <div className="space-y-2">
            {NAV_ITEMS.map(({ to, icon: Icon, label, end, state }) => (
              <NavLink
                key={label}
                to={to}
                end={end}
                state={state}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#D89B00] text-white shadow-md'
                      : 'text-gray-300 hover:bg-[#3C3C3C] hover:text-white'
                  }`
                }
              >
                <Icon size={19} />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-[#444] px-5 py-4">
          <p
            className="truncate text-xs text-gray-300"
            title={profile?.full_name || session?.user?.email}
          >
            {profile?.full_name || session?.user?.email}
          </p>
          {profile?.full_name && (
            <p className="truncate text-[11px] text-gray-500">{session?.user?.email}</p>
          )}

          <button
            onClick={() => navigate('/sectors')}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#3C3C3C] hover:text-white"
          >
            <ArrowLeft size={16} />
            Field order app
          </button>

          <button
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#3C3C3C] hover:text-white"
          >
            <LogOut size={16} />
            Sign Out
          </button>

          <p className="mt-3 text-[11px] text-gray-500">
            MB Development Corporation
          </p>
        </div>
      </aside>

      <main className="ml-64 flex-1 px-8 py-8">{children}</main>
    </div>
  )
}
