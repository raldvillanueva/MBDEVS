import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ArrowUpRight,
  ShieldPlus,
  ShieldCheck,
  UserCheck2,
  ClipboardList,
  Eye,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import { supabase } from '../../lib/supabase'

// Online/offline is deliberately absent: nothing tracks presence, and a
// made-up "3 online" is worse than no number at all.
const ROLE_CARDS = [
  { type: 'admin', label: 'Admin', icon: ShieldCheck, iconClass: 'bg-amber-100 text-amber-700' },
  { type: 'supervisor', label: 'Supervisor', icon: UserCheck2, iconClass: 'bg-emerald-100 text-emerald-700' },
  { type: 'encoder', label: 'Encoder', icon: ClipboardList, iconClass: 'bg-purple-100 text-purple-700' },
  { type: 'viewer', label: 'Viewer', icon: Eye, iconClass: 'bg-slate-200 text-slate-700' },
]

const TYPE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  encoder: 'Encoder',
  viewer: 'Viewer',
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, full_name, account_type, created_at')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalUsers = users.length
  // Newest accounts, since "recently active" needs presence tracking we
  // do not have.
  const newest = users.slice(0, 3)

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

      {error && (
        <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Top stat row */}
      <div className="mb-6 grid max-w-3xl grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Accounts</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-[#2E2E2E]">{loading ? '—' : totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-500">
            <ShieldCheck size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Super Admins</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-[#2E2E2E]">
            {loading ? '—' : users.filter(u => u.account_type === 'super_admin').length}
          </p>
        </div>
      </div>

      {/* Breakdown by role */}
      <div className="mb-6 max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">By Role</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ROLE_CARDS.map(({ type, label, icon: Icon, iconClass }) => {
            const count = users.filter((u) => u.account_type === type).length
            return (
              <div
                key={type}
                className="flex items-center gap-3 rounded-xl border border-[#D9D9D9] bg-white px-3 py-3 shadow-sm"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-[#2E2E2E]">{loading ? '—' : count}</p>
                  <p className="text-xs text-slate-500">{label}</p>
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
            <h2 className="font-semibold text-[#2E2E2E]">Newest Accounts</h2>
            <button
              onClick={load}
              title="Refresh"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw size={14} />
            </button>
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
          {loading && (
            <li className="px-5 py-6 text-center text-sm text-slate-400">Loading accounts…</li>
          )}
          {!loading && newest.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-slate-400">No accounts yet.</li>
          )}
          {!loading && newest.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0"
            >
              <div>
                <p className="font-medium text-[#2E2E2E]">{u.full_name || u.email || 'No name set'}</p>
                {u.full_name && <p className="text-xs text-slate-500">{u.email}</p>}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {TYPE_LABELS[u.account_type] || u.account_type || '—'}
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
