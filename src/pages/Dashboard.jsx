import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClipboardList, CheckCircle2, XCircle, RefreshCw,
  Trash2, Wrench, PackageCheck, AlertCircle, AlertTriangle
} from 'lucide-react'
import { isOverdue } from '../lib/aging'

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

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('field_orders')
        .select('status_crew, fo_type, for_batch, billed_amount, crew_name, field_order_no, location, created_at, seq, date_executed, date_returned, archived_at')
        .order('seq', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const total = data.length
      const fieldComplete = data.filter(r => r.status_crew?.toUpperCase().includes('FIELD')).length
      const cancel = data.filter(r => r.status_crew?.toUpperCase() === 'CANCEL').length
      const replace = data.filter(r => r.fo_type?.toUpperCase() === 'REPLACE').length
      const retire = data.filter(r => r.fo_type?.toUpperCase() === 'RETIRE').length
      const remove = data.filter(r => r.fo_type?.toUpperCase() === 'REMOVE').length
      const batched = data.filter(r => r.for_batch?.toUpperCase().includes('ALREADY')).length
      const totalBilled = data.reduce((sum, r) => sum + (parseFloat(r.billed_amount) || 0), 0)
      const overdue = data.filter(r => !r.archived_at && isOverdue(r)).length

      setStats({ total, fieldComplete, cancel, replace, retire, remove, batched, totalBilled, overdue })
      setRecent(data.slice(0, 8))
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of all field order activity</p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Field Orders" value={stats.total} icon={ClipboardList} color="bg-blue-500" />
            <StatCard label="Field Complete" value={stats.fieldComplete} icon={CheckCircle2} color="bg-emerald-500" />
            <StatCard label="Cancelled" value={stats.cancel} icon={XCircle} color="bg-red-500" />
            <StatCard
              label="Total Billed"
              value={`₱${stats.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
              icon={PackageCheck}
              color="bg-violet-500"
            />
            <StatCard label="Overdue (>21 days)" value={stats.overdue} icon={AlertTriangle} color="bg-red-600" sub="Meter not yet returned" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Replace Jobs" value={stats.replace} icon={RefreshCw} color="bg-amber-500" />
            <StatCard label="Retire Jobs" value={stats.retire} icon={Trash2} color="bg-orange-500" />
            <StatCard label="Remove Jobs" value={stats.remove} icon={Wrench} color="bg-slate-500" />
            <StatCard label="Already Batched" value={stats.batched} icon={AlertCircle} color="bg-teal-500" />
          </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Recent Field Orders</h2>
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
                <th className="px-6 py-3 text-left font-medium">FO Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-slate-700">{row.field_order_no || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{row.crew_name || '—'}</td>
                  <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{row.location || '—'}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={row.status_crew} />
                  </td>
                  <td className="px-6 py-3">
                    <FoTypeBadge type={row.fo_type} />
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No records yet. Add your first field order.
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

function FoTypeBadge({ type }) {
  const t = type?.toUpperCase() || ''
  if (t === 'REPLACE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">REPLACE</span>
  if (t === 'RETIRE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">RETIRE</span>
  if (t === 'REMOVE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">REMOVE</span>
  if (t === 'CANCEL') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">CANCEL</span>
  return <span className="text-slate-400 text-xs">{type || '—'}</span>
}
