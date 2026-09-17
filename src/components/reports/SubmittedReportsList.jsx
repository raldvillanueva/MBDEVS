import { useCallback, useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SECTOR_LABELS, DATA_SECTORS } from '../../lib/sectorTables'
import AuditReportSnapshot from './AuditReportSnapshot'
import { overdueCriticalOf } from '../../lib/reportStats'

const SECTOR_TABS = ['all', ...DATA_SECTORS]

// Shared by every role that can review submitted reports (Admin,
// Super Admin — all `role = 'admin'` underneath, see audit_reports_setup.sql).
// `extraSummary`, if given, renders above the table (e.g. Super Admin's
// cross-sector rollup) so each page can add its own emphasis on top of the
// same underlying data and table.
export default function SubmittedReportsList({ extraSummary, rowHighlight }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError('')
    let query = supabase.from('audit_reports').select('*').order('submitted_at', { ascending: false })
    if (sectorFilter !== 'all') query = query.eq('sector', sectorFilter)
    const { data, error: fetchError } = await query
    if (fetchError) setError('We could not load submitted reports.')
    else setReports(data || [])
    setLoading(false)
  }, [sectorFilter])

  useEffect(() => {
    fetchReports()
    const channel = supabase
      .channel('audit_reports_review')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_reports' }, () => fetchReports())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchReports])

  const visible = reports.filter(r =>
    !search || (r.generated_by_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {extraSummary}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {SECTOR_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setSectorFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                sectorFilter === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'all' ? 'All sectors' : SECTOR_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by submitter..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-xs text-slate-300">
              <th className="px-4 py-3 text-left font-medium">SUBMITTED</th>
              <th className="px-4 py-3 text-left font-medium">SECTOR</th>
              <th className="px-4 py-3 text-left font-medium">SUBMITTED BY</th>
              <th className="px-4 py-3 text-left font-medium">COVERS</th>
              <th className="px-4 py-3 text-right font-medium">TOTAL RECORDS</th>
              <th className="px-4 py-3 text-right font-medium">OVERDUE &gt;21</th>
              <th className="px-4 py-3 text-right font-medium">TOTAL BILLED</th>
              <th className="px-4 py-3 text-right font-medium">VIEW</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">Loading submitted reports...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">No submitted reports yet.</td></tr>
            ) : visible.map(report => {
              const flagged = rowHighlight?.(report)
              return (
                <tr key={report.id} className={`border-t border-slate-100 hover:bg-slate-50 ${flagged ? 'bg-red-50/60' : ''}`}>
                  <td className="px-4 py-3 text-slate-600">{new Date(report.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{SECTOR_LABELS[report.sector] || report.sector}</td>
                  <td className="px-4 py-3 text-slate-600">{report.generated_by_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{report.date_from || '…'} – {report.date_to || '…'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{report.stats?.total ?? '—'}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${overdueCriticalOf(report.stats) > 0 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                    {overdueCriticalOf(report.stats)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    ₱{(report.stats?.totalBilled || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setViewing(report)} className="text-sm font-medium text-blue-600 hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Submitted Report</h3>
              <button onClick={() => setViewing(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <AuditReportSnapshot
              stats={viewing.stats}
              meta={{
                sector: viewing.sector,
                dateFrom: viewing.date_from,
                dateTo: viewing.date_to,
                submittedBy: viewing.generated_by_name,
                submittedAt: viewing.submitted_at,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
