import { useNavigate } from 'react-router-dom'
import { LogOut, ArrowLeftRight } from 'lucide-react'
import logo from '../assets/mb-logo.jpg'
import { useAuth } from '../lib/AuthContext'
import { useSector } from '../lib/SectorContext'
import { supabase } from '../lib/supabase'
import { ROLE_DASHBOARDS } from '../data/roleDashboards'
import { dashboardKeyFor } from '../lib/rolePaths'

/**
 * Sidebar for the role landing pages. It shows who is signed in and what
 * they are — no role switcher: an account sees its own dashboard and no
 * other, which is the point of the guards on these routes.
 *
 * Super Admin is the exception. It can open any role's page, so it gets a
 * way back to its own.
 */
export default function RoleDashboardSidebar() {
  const { profile, session, accountType } = useAuth()
  const { clearSector } = useSector()
  const navigate = useNavigate()

  const config = ROLE_DASHBOARDS[dashboardKeyFor(accountType)]
  const isSuperAdmin = accountType === 'super_admin'

  async function handleSignOut() {
    clearSector()
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
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
        {config && (
          <span
            className={`mt-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${config.badgeClass}`}
          >
            {config.label}
          </span>
        )}
      </div>

      <nav className="flex-1 px-4 py-5">
        <p className="px-2 text-xs text-gray-500">
          Pick a task to get started. Everything you are allowed to do is on
          this page.
        </p>

        {isSuperAdmin && (
          <button
            onClick={() => navigate('/super-admin')}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-300 transition-all duration-200 hover:bg-[#3C3C3C] hover:text-white"
          >
            <ArrowLeftRight size={17} />
            <span className="flex-1 text-left">Super Admin area</span>
          </button>
        )}
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
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#3C3C3C] hover:text-white"
        >
          <LogOut size={16} />
          Sign Out
        </button>

        <p className="mt-3 text-[11px] text-gray-500">
          MB Development Corporation
        </p>
      </div>
    </aside>
  )
}
