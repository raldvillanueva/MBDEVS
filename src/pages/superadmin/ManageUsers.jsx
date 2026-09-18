import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Search, RefreshCw, AlertTriangle, Info, UserPlus, KeyRound, Pencil } from 'lucide-react'
import CreateAccountModal from '../../components/CreateAccountModal'
import ResetPasswordModal from '../../components/ResetPasswordModal'
import EditAccountModal from '../../components/EditAccountModal'
import SuperAdminLayout from './SuperAdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { logAudit, AUDIT_ACTIONS } from '../../lib/auditLog'

// account_type is what the app reads; role is the coarse bucket RLS reads.
// They are set together so the two can never drift — an account_type of
// 'admin' sitting on role 'staff' would show admin pages while the database
// refused every action on them.
const ACCOUNT_TYPES = [
  { value: 'super_admin', label: 'Super Admin', role: 'admin', tint: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Admin', role: 'admin', tint: 'bg-amber-100 text-amber-800' },
  { value: 'encoder', label: 'Encoder', role: 'staff', tint: 'bg-purple-100 text-purple-700' },
  { value: 'viewer', label: 'Viewer', role: 'staff', tint: 'bg-slate-100 text-slate-600' },
]

const FILTERS = ['All', ...ACCOUNT_TYPES.map(t => t.value)]

function labelFor(accountType) {
  return ACCOUNT_TYPES.find(t => t.value === accountType)?.label || accountType || '—'
}

function tintFor(accountType) {
  return ACCOUNT_TYPES.find(t => t.value === accountType)?.tint || 'bg-slate-100 text-slate-600'
}

export default function ManageUsers() {
  const { session, profile } = useAuth()

  // Only a Super Admin reaches this page — ManageUsersRoute turns everyone
  // else away, and profiles_update refuses them at the database besides. So
  // every account type here is assignable.
  const assignable = ACCOUNT_TYPES
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, username, email, full_name, role, account_type, created_at')
      .order('account_type', { ascending: true })

    if (err) setError(err.message)
    else setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function changeAccountType(user, accountType) {
    const spec = ACCOUNT_TYPES.find(t => t.value === accountType)
    if (!spec) return

    setSavingId(user.id)
    setError('')
    setNotice('')

    // role travels with account_type — see the note on ACCOUNT_TYPES.
    const { error: err } = await supabase
      .from('profiles')
      .update({ account_type: spec.value, role: spec.role })
      .eq('id', user.id)

    setSavingId(null)

    if (err) {
      setError(
        err.message.includes('policy')
          ? 'Only a Super Admin can change account types.'
          : err.message,
      )
      return
    }

    logAudit({
      session, profile,
      action: AUDIT_ACTIONS.ACCOUNT_ROLE_CHANGED,
      targetLabel: user.username || user.email || user.full_name,
      targetId: user.id,
      details: { from: user.account_type, to: spec.value },
    })

    setNotice(`${user.username || user.email || 'Account'} is now ${spec.label}.`)
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      const matchesFilter = filter === 'All' || u.account_type === filter
      const matchesSearch =
        !q ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })
  }, [users, search, filter])

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">Manage Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every account in the system, and what each one is allowed to do.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00]"
          >
            <UserPlus size={16} />
            Create Account
          </button>
        </div>
      </div>

      <div className="mb-4 flex max-w-4xl items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          New accounts sign in with the username and password you set — there is no confirmation
          email to wait for. The email address is kept for password resets and one-time codes,
          not for signing in. Change what an account is allowed to do with the dropdown on its row.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex max-w-4xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-4 max-w-4xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="max-w-4xl overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9D9D9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#D89B00]" />
            <h2 className="font-semibold text-[#2E2E2E]">
              All Users
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {users.length}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-[#D9D9D9] bg-slate-50 px-5 py-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username, name or email"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === f ? 'bg-[#D89B00] text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f === 'All' ? 'All' : labelFor(f)}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D9D9D9] text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Username</th>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Current</th>
              <th className="px-5 py-3 font-semibold">Change to</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Loading accounts…</td></tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No accounts match that search.</td></tr>
            )}

            {!loading && filtered.map(u => {
              const isSelf = u.id === session?.user?.id
              return (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-mono text-sm text-[#2E2E2E]">
                    {u.username || <span className="font-sans text-slate-400">Not set</span>}
                  </td>
                  <td className="px-5 py-3 font-medium text-[#2E2E2E]">
                    {u.full_name || <span className="text-slate-400">No name set</span>}
                    {isSelf && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tintFor(u.account_type)}`}>
                      {labelFor(u.account_type)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.account_type || ''}
                      disabled={savingId === u.id || isSelf}
                      onChange={e => changeAccountType(u, e.target.value)}
                      // Demoting yourself would strip the very access needed to
                      // undo it, so your own row is locked.
                      title={
                        isSelf
                          ? 'You cannot change your own account type'
                          : 'Change this account type'
                      }
                      className="rounded-lg border border-[#D9D9D9] bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#D89B00] disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {/* The current value has to be listed even when it is
                          not assignable, or the select would show the wrong
                          account type back to the user. */}
                      {(assignable.some(t => t.value === u.account_type)
                        ? assignable
                        : [...assignable, ACCOUNT_TYPES.find(t => t.value === u.account_type)].filter(Boolean)
                      ).map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditTarget(u)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        title={`Edit ${u.username || u.email}`}
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        title={`Set a new password for ${u.username || u.email}`}
                      >
                        <KeyRound size={13} />
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditAccountModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(user, changes) => {
            logAudit({
              session, profile,
              action: AUDIT_ACTIONS.ACCOUNT_UPDATED,
              targetLabel: user.username || user.email,
              targetId: user.id,
              // The fields that changed, not the values — an audit entry
              // is not a place to keep a second copy of personal details.
              details: { fields: Object.keys(changes) },
            })
            setNotice(`${changes.username || user.username || user.email} updated.`)
            load()
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={user => {
            logAudit({
              session, profile,
              action: AUDIT_ACTIONS.ACCOUNT_PASSWORD_RESET,
              targetLabel: user.username || user.email,
              targetId: user.id,
            })
          }}
        />
      )}

      <CreateAccountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={created => {
          logAudit({
            session, profile,
            action: AUDIT_ACTIONS.ACCOUNT_CREATED,
            targetLabel: created?.email,
            targetId: created?.user_id,
            details: { account_type: created?.account_type },
          })
          load()
        }}
      />
    </SuperAdminLayout>
  )
}
