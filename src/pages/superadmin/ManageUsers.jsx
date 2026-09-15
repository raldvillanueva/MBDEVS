import { useState, useMemo } from 'react'
import { Users, Circle, UserPlus, Ban, Search } from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import CreateAccountModal from '../../components/CreateAccountModal'

// Sample data only — there is no login/session and no online-presence
// tracking wired up yet, so this is a stand-in for layout purposes.
// Mirrors the same placeholder rows shown on the Super Admin Dashboard.
const SAMPLE_USERS = [
  { name: 'Marco Bautista', email: 'marco.bautista@mbdevs.com', role: 'Admin', online: true },
  { name: 'Jessa Villanueva', email: 'jessa.villanueva@mbdevs.com', role: 'Supervisor', online: true },
  { name: 'Ronald Cruz', email: 'ronald.cruz@mbdevs.com', role: 'Encoder', online: false },
  { name: 'Aira Domingo', email: 'aira.domingo@mbdevs.com', role: 'Encoder', online: true },
  { name: 'Kevin Santos', email: 'kevin.santos@mbdevs.com', role: 'Viewer', online: false },
]

const ROLE_FILTERS = ['All', 'Admin', 'Supervisor', 'Encoder', 'Viewer']

export default function ManageUsers() {
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return SAMPLE_USERS.filter((u) => {
      const matchesRole = roleFilter === 'All' || u.role === roleFilter
      const matchesSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      return matchesRole && matchesSearch
    })
  }, [search, roleFilter])

  return (
    <SuperAdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">Manage Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, disable, and manage Admin/Supervisor/Encoder/Viewer accounts.
          </p>
        </div>
        <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Super Admin
        </span>
      </div>

      <p className="mb-4 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        The rows below are sample data — there’s no database connection yet, so
        this is a layout placeholder. Account creation below is a UI mock: it walks
        through the full flow but doesn’t create a real account.
      </p>

      <div className="max-w-3xl overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9D9D9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#D89B00]" />
            <h2 className="font-semibold text-[#2E2E2E]">All Users</h2>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00]"
          >
            <UserPlus size={16} />
            Create Account
          </button>
        </div>

        {/* Search + role filter — this is the working table, not a glance view */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#D9D9D9] bg-slate-50 px-5 py-3">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  roleFilter === r
                    ? 'bg-[#D89B00] text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D9D9D9] text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                  No users match that search.
                </td>
              </tr>
            )}
            {filteredUsers.map((u) => (
              <tr key={u.email} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-medium text-[#2E2E2E]">{u.name}</td>
                <td className="px-5 py-3 text-slate-500">{u.email}</td>
                <td className="px-5 py-3 text-slate-600">{u.role}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      u.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Circle size={8} fill="currentColor" />
                    {u.online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    disabled
                    title="Not wired up yet — needs database access"
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-400"
                  >
                    <Ban size={12} />
                    Disable
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateAccountModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </SuperAdminLayout>
  )
}
