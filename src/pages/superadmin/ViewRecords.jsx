import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'

const PAGE_SIZE = 50

function StatusBadge({ status }) {
  const s = (status || '').toUpperCase()
  if (s === 'CANCEL') return <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">CANCEL</span>
  if (s.includes('FIELD')) return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">FIELD COMPL.</span>
  return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{status || '—'}</span>
}

// This queries the `field_orders` table directly (no ProtectedRoute, no
// session check) — it works today because that table's Row Level Security
// policy is "Allow all" with no `to authenticated` restriction (see
// supabase_schema.sql), so the public anon key can already read it.
//
// Note this only covers Rizal's data. Manila/Pasig/Balintawak's tables use
// a stricter `to authenticated` SELECT policy (see sector_tables_setup.sql),
// so this same approach will NOT show their records without a login.
export default function ViewRecords() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('field_orders')
      .select('field_order_no, job_description, crew_name, date_executed, status_crew, location')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (err) setError(err.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <SuperAdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">View Records</h1>
          <p className="mt-1 text-sm text-slate-500">
            Field orders — Rizal sector, most recent {PAGE_SIZE}.
          </p>
        </div>
        <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Super Admin
        </span>
      </div>

      <div className="mb-4 flex max-w-3xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          This is live data, no login required — it only works because the
          <code className="mx-1 rounded bg-amber-100 px-1">field_orders</code>
          table's Row Level Security currently allows anyone to read (and
          write) it. Worth locking that down to a read-only public policy
          before this goes live. Manila/Pasig/Balintawak aren't reachable
          this way since their tables already require a login.
        </p>
      </div>

      <div className="max-w-3xl overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-5 py-4">
          <h2 className="font-semibold text-[#2E2E2E]">Field Orders</h2>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Loading…</p>
        )}

        {!loading && error && (
          <p className="px-5 py-8 text-center text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No records found.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#D9D9D9] text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Field Order</th>
                <th className="px-5 py-3 font-semibold">Job Description</th>
                <th className="px-5 py-3 font-semibold">Crew</th>
                <th className="px-5 py-3 font-semibold">Date Executed</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.field_order_no || i} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-[#2E2E2E]">{r.field_order_no || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{r.job_description || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{r.crew_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{r.date_executed || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status_crew} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SuperAdminLayout>
  )
}
