import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  PackageCheck, Layers, AlertTriangle, Calendar, X
} from 'lucide-react'
import { isOverdueBy } from '../lib/aging'

function Section({ title, children }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

// Headline figures: icon chip + large number.
function StatCard({ label, value, icon: Icon, tint, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon size={16} />
        </span>
        <p className="text-sm leading-tight text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-800">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// Breakdown figures: deliberately lighter than StatCard so the FO Action
// split reads as supporting detail rather than another row of headlines.
function MiniStat({ label, value, dot }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <p className="truncate text-sm text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800">{value}</p>
    </div>
  )
}

// A field order still needs crew action while it is neither completed nor cancelled.
function isPendingTask(row) {
  const status = row.status_crew?.toUpperCase() || ''
  return !row.archived_at && !status.includes('FIELD') && !status.includes('CANCEL')
}

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('field_orders')
        .select('status_crew, fo_type, fo_action, for_batch, billed_amount, crew_name, field_order_no, location, created_at, seq, date_assign, date_executed, date_returned, archived_at')
        .order('seq', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      setRows(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // date_executed is a plain "YYYY-MM-DD" string, so the range check is a
  // direct string comparison against the date inputs (same format).
  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return rows
    return rows.filter(row => {
      if (!row.date_executed) return false
      if (dateFrom && row.date_executed < dateFrom) return false
      if (dateTo && row.date_executed > dateTo) return false
      return true
    })
  }, [rows, dateFrom, dateTo])

  const stats = useMemo(() => {
    const status = row => row.status_crew?.toUpperCase() || ''
    const action = row => row.fo_action?.toUpperCase() || ''

    return {
      assigned: filtered.filter(r => ['ASSIGNED', 'REASSIGN'].includes(status(r))).length,
      fieldComplete: filtered.filter(r => status(r).includes('FIELD')).length,
      cancelled: filtered.filter(r => status(r).includes('CANCEL')).length,
      totalBilled: filtered.reduce((sum, r) => sum + (parseFloat(r.billed_amount) || 0), 0),

      overdue10: filtered.filter(r => !r.archived_at && isOverdueBy(r, 10)).length,
      overdue21: filtered.filter(r => !r.archived_at && isOverdueBy(r, 21)).length,
      batched: filtered.filter(r => r.for_batch?.toUpperCase().includes('ALREADY')).length,

      replacement: filtered.filter(r => action(r) === 'REPLACE FO').length,
      retirement: filtered.filter(r => action(r) === 'RETIREMENT FO').length,
      energize: filtered.filter(r => action(r) === 'ENERGIZED FO').length,
      others: filtered.filter(r => action(r) === 'OTHERS').length,
    }
  }, [filtered])

  const todo = useMemo(() => filtered.filter(isPendingTask).slice(0, 8), [filtered])
  const isFiltered = !!(dateFrom || dateTo)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-7 pb-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Overview of all field order activity</p>
        </div>

        <div
          title="Filter by date executed"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <Calendar size={15} className="shrink-0 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-[130px] bg-transparent text-sm text-slate-700 focus:outline-none"
          />
          <span className="text-slate-300">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-[130px] bg-transparent text-sm text-slate-700 focus:outline-none"
          />
          {isFiltered && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              title="Clear date filter"
              className="ml-0.5 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {isFiltered && (
        <div className="-mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
          Showing <strong className="font-semibold">{filtered.length}</strong> of {rows.length} field orders by date executed
        </div>
      )}

      <Section title="Status">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Assigned" value={stats.assigned} icon={ClipboardList} tint="bg-blue-50 text-blue-600" />
          <StatCard label="Field Complete" value={stats.fieldComplete} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
          <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tint="bg-rose-50 text-rose-600" />
          <StatCard
            label="Total Billed"
            value={`₱${stats.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
            icon={PackageCheck}
            tint="bg-violet-50 text-violet-600"
          />
        </div>
      </Section>

      <Section title="Needs attention">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Overdue (>10 days)"
            value={stats.overdue10}
            icon={Clock}
            tint="bg-amber-50 text-amber-600"
            sub="Meter not yet returned"
          />
          <StatCard
            label="Overdue (>21 days)"
            value={stats.overdue21}
            icon={AlertTriangle}
            tint="bg-red-50 text-red-600"
            sub="Meter not yet returned"
          />
          <StatCard
            label="Already Batched"
            value={stats.batched}
            icon={Layers}
            tint="bg-teal-50 text-teal-600"
            sub="Counted as returned"
          />
        </div>
      </Section>

      <Section title="By FO Action">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Replacement FO" value={stats.replacement} dot="bg-amber-500" />
          <MiniStat label="Retirement FO" value={stats.retirement} dot="bg-slate-400" />
          <MiniStat label="Energize FO" value={stats.energize} dot="bg-yellow-500" />
          <MiniStat label="Others" value={stats.others} dot="bg-indigo-500" />
        </div>
      </Section>

      <Section title="To-Do List">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <p className="text-sm text-slate-500">
              Pending tasks — not yet completed or cancelled
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {filtered.filter(isPendingTask).length}
              </span>
            </p>
            <button
              onClick={() => navigate('/field-orders')}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 text-left font-medium">Field Order</th>
                  <th className="px-5 py-2.5 text-left font-medium">Crew</th>
                  <th className="px-5 py-2.5 text-left font-medium">Location</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-left font-medium">FO Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todo.map((row, i) => (
                  <tr key={i} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-slate-700">{row.field_order_no || '—'}</td>
                    <td className="px-5 py-2.5 text-slate-600">{row.crew_name || '—'}</td>
                    <td className="max-w-xs truncate px-5 py-2.5 text-slate-600">{row.location || '—'}</td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={row.status_crew} />
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{row.fo_action || '—'}</td>
                  </tr>
                ))}
                {todo.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                      No pending tasks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  )
}

function StatusBadge({ status }) {
  const s = status?.toUpperCase() || ''
  if (s === 'CANCEL') return <span className="rounded px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-700">CANCEL</span>
  if (s.includes('FIELD')) return <span className="rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">FIELD COMPL.</span>
  return <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">{status || '—'}</span>
}
