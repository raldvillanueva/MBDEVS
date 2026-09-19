import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, AlertTriangle, Trash2, Archive, ArchiveRestore, CheckCircle2, XCircle, UserPlus, ShieldCheck, KeyRound, Pencil } from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import { supabase } from '../../lib/supabase'
import { AUDIT_ACTION_LABELS } from '../../lib/auditLog'

const PAGE_SIZE = 100

// Colour carries the weight of the action: destructive in red, reversible in
// amber, additive in green. Scanning for "what was destroyed" should not mean
// reading every row.
const ACTION_STYLE = {
  'record.deleted': { icon: Trash2, tint: 'bg-red-100 text-red-700' },
  'record.archived': { icon: Archive, tint: 'bg-amber-100 text-amber-800' },
  'record.restored': { icon: ArchiveRestore, tint: 'bg-emerald-100 text-emerald-700' },
  'deletion.approved': { icon: CheckCircle2, tint: 'bg-red-100 text-red-700' },
  'deletion.rejected': { icon: XCircle, tint: 'bg-slate-100 text-slate-600' },
  'edit.approved': { icon: Pencil, tint: 'bg-blue-100 text-blue-700' },
  'edit.rejected': { icon: XCircle, tint: 'bg-slate-100 text-slate-600' },
  'account.created': { icon: UserPlus, tint: 'bg-blue-100 text-blue-700' },
  'account.role_changed': { icon: ShieldCheck, tint: 'bg-purple-100 text-purple-700' },
  'account.password_reset': { icon: KeyRound, tint: 'bg-amber-100 text-amber-800' },
  'account.updated': { icon: Pencil, tint: 'bg-slate-100 text-slate-600' },
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'record.deleted', label: 'Deletions' },
  { value: 'record.archived', label: 'Archives' },
  { value: 'edit.approved', label: 'Edit approvals' },
  { value: 'account.created', label: 'New accounts' },
  { value: 'account.role_changed', label: 'Role changes' },
  { value: 'account.password_reset', label: 'Password resets' },
]

function when(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditLogs() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (err) setError(err.message)
    else setEntries(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      const matchesFilter = filter === 'all' || e.action === filter
      const matchesSearch =
        !q ||
        e.actor_name?.toLowerCase().includes(q) ||
        e.actor_email?.toLowerCase().includes(q) ||
        e.target_label?.toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })
  }, [entries, search, filter])

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who deleted, archived or reassigned what — and when.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex max-w-4xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="max-w-4xl overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#D9D9D9] bg-slate-50 px-5 py-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by person or field order"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filter === f.value ? 'bg-[#D89B00] text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D9D9D9] text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Action</th>
              <th className="px-5 py-3 font-semibold">Target</th>
              <th className="px-5 py-3 font-semibold">By</th>
              <th className="px-5 py-3 font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  {entries.length === 0
                    ? 'Nothing logged yet. Entries appear here as records are deleted, archived or reassigned.'
                    : 'No entries match that search.'}
                </td>
              </tr>
            )}

            {!loading && filtered.map(e => {
              const style = ACTION_STYLE[e.action] || { icon: ShieldCheck, tint: 'bg-slate-100 text-slate-600' }
              const Icon = style.icon
              return (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.tint}`}>
                      <Icon size={12} />
                      {AUDIT_ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-slate-700">{e.target_label || '—'}</span>
                    {e.sector && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        {e.sector}
                      </span>
                    )}
                    {e.details?.count > 1 && (
                      <span className="ml-2 text-xs text-slate-400">and {e.details.count - 1} more</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {e.actor_name || e.actor_email || '—'}
                    {e.actor_name && e.actor_email && (
                      <p className="text-xs text-slate-400">{e.actor_email}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">{when(e.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && entries.length >= PAGE_SIZE && (
        <p className="mt-3 max-w-4xl text-xs text-slate-400">
          Showing the {PAGE_SIZE} most recent entries.
        </p>
      )}
    </SuperAdminLayout>
  )
}
