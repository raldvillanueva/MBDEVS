import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClipboardList, CheckCircle2, XCircle, RefreshCw, Clock,
  PackageCheck, Layers, AlertTriangle, Zap, Trash2, MoreHorizontal
} from 'lucide-react'
import { isOverdueBy } from '../lib/aging'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start gap-4">
      <div className={`rounded-lg p-3 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-slate-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of all field order activity</p>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {(dateFrom || dateTo) && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {rows.length} field orders by date executed.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assigned" value={stats.assigned} icon={ClipboardList} color="bg-blue-500" />
        <StatCard label="Field Complete" value={stats.fieldComplete} icon={CheckCircle2} color="bg-emerald-500" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} color="bg-red-500" />
        <StatCard
          label="Total Billed"
          value={`₱${stats.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          icon={PackageCheck}
          color="bg-violet-500"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Overdue (>10 days)" value={stats.overdue10} icon={Clock} color="bg-orange-500" sub="Meter not yet returned" />
        <StatCard label="Overdue (>21 days)" value={stats.overdue21} icon={AlertTriangle} color="bg-red-600" sub="Meter not yet returned" />
        <StatCard label="Already Batched" value={stats.batched} icon={Layers} color="bg-teal-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Replacement FO" value={stats.replacement} icon={RefreshCw} color="bg-amber-500" />
        <StatCard label="Retirement FO" value={stats.retirement} icon={Trash2} color="bg-slate-500" />
        <StatCard label="Energize FO" value={stats.energize} icon={Zap} color="bg-yellow-500" />
        <StatCard label="Others" value={stats.others} icon={MoreHorizontal} color="bg-indigo-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-700">To-Do List</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pending tasks — field orders not yet completed or cancelled</p>
          </div>
          <button
            onClick={() => navigate('/field-orders')}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left font-medium">Field Order</th>
                <th className="px-6 py-3 text-left font-medium">Crew</th>
                <th className="px-6 py-3 text-left font-medium">Location</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">FO Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todo.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-slate-700">{row.field_order_no || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{row.crew_name || '—'}</td>
                  <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{row.location || '—'}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={row.status_crew} />
                  </td>
                  <td className="px-6 py-3 text-slate-600">{row.fo_action || '—'}</td>
                </tr>
              ))}
              {todo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No pending tasks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const s = status?.toUpperCase() || ''
  if (s === 'CANCEL') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">CANCEL</span>
  if (s.includes('FIELD')) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">FIELD COMPL.</span>
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{status || '—'}</span>
}
