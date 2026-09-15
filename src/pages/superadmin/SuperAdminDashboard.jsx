import { useNavigate } from 'react-router-dom'
import {
  Users,
  Circle,
  ArrowUpRight,
  ShieldPlus,
  ShieldCheck,
  UserCheck2,
  ClipboardList,
  Eye,
  Wifi,
} from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'

// Sample data only — there is no login/session and no online-presence
// tracking wired up yet, so this is a stand-in for layout purposes.
const SAMPLE_USERS = [
  { name: 'Marco Bautista', email: 'marco.bautista@mbdevs.com', role: 'Admin', online: true },
  { name: 'Jessa Villanueva', email: 'jessa.villanueva@mbdevs.com', role: 'Supervisor', online: true },
  { name: 'Ronald Cruz', email: 'ronald.cruz@mbdevs.com', role: 'Encoder', online: false },
  { name: 'Aira Domingo', email: 'aira.domingo@mbdevs.com', role: 'Encoder', online: true },
  { name: 'Kevin Santos', email: 'kevin.santos@mbdevs.com', role: 'Viewer', online: false },
]

const ROLE_CARDS = [
  { role: 'Admin', icon: ShieldCheck, iconClass: 'bg-amber-100 text-amber-700' },
  { role: 'Supervisor', icon: UserCheck2, iconClass: 'bg-emerald-100 text-emerald-700' },
  { role: 'Encoder', icon: ClipboardList, iconClass: 'bg-purple-100 text-purple-700' },
  { role: 'Viewer', icon: Eye, iconClass: 'bg-slate-200 text-slate-700' },
]

export default function SuperAdminDashboard() {
  const navigate = useNavigate()

  const totalUsers = SAMPLE_USERS.length
  const onlineCount = SAMPLE_USERS.filter((u) => u.online).length
  const recentlyActive = SAMPLE_USERS.filter((u) => u.online).slice(0, 3)

  function goToManageUsers() {
    navigate('/super-admin/manage-users')
  }

  function goToManageAdmins() {
    navigate('/super-admin/manage-admins')
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            A quick look at who has access right now.
          </p>
        </div>
        <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Super Admin
        </span>
      </div>

      <p className="mb-6 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        The numbers below are sample data — online/offline status isn't tracked
        in the database yet, so this is a layout placeholder, not live data.
      </p>

      {/* Top stat row */}
      <div className="mb-6 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Users</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-[#2E2E2E]">{totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-500">
            <Wifi size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Online Now</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-[#2E2E2E]">{onlineCount}</p>
        </div>
        <div className="rounded-2xl border border-dashed border-[#D89B00] bg-[#FFF6E5] p-4 shadow-sm sm:col-span-1 col-span-2">
          <div className="flex items-center gap-2 text-[#D89B00]">
            <Circle size={8} fill="currentColor" />
            <span className="text-xs font-semibold uppercase tracking-wide">Offline</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-[#2E2E2E]">{totalUsers - onlineCount}</p>
        </div>
      </div>

      {/* Breakdown by role */}
      <div className="mb-6 max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">By Role</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLE_CARDS.map(({ role, icon: Icon, iconClass }) => {
            const count = SAMPLE_USERS.filter((u) => u.role === role).length
            return (
              <div
                key={role}
                className="flex items-center gap-3 rounded-xl border border-[#D9D9D9] bg-white px-3 py-3 shadow-sm"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-[#2E2E2E]">{count}</p>
                  <p className="text-xs text-slate-500">{role}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recently active — compact glance, not the full table */}
      <div className="mb-6 max-w-3xl overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Circle size={8} fill="currentColor" className="text-emerald-500" />
            <h2 className="font-semibold text-[#2E2E2E]">Recently Active</h2>
          </div>
          <button
            onClick={goToManageUsers}
            className="flex items-center gap-1 text-sm font-semibold text-[#D89B00] hover:underline"
          >
            View all users
            <ArrowUpRight size={15} />
          </button>
        </div>

        <ul>
          {recentlyActive.map((u) => (
            <li
              key={u.email}
              className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0"
            >
              <div>
                <p className="font-medium text-[#2E2E2E]">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Manage Admins — separate quick action */}
      <button
        onClick={goToManageAdmins}
        className="flex max-w-3xl items-center gap-2 rounded-xl border border-[#D89B00] bg-[#FFF6E5] px-5 py-4 text-sm font-semibold text-[#2E2E2E] transition hover:bg-[#FCE9BE]"
      >
        <ShieldPlus size={18} className="text-[#D89B00]" />
        Manage Admins
      </button>
    </SuperAdminLayout>
  )
}
