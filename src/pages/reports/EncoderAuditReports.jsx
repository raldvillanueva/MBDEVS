import { useCallback, useEffect, useState } from 'react'
import { Calendar, FileText, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useSector } from '../../lib/SectorContext'
import { DATA_SECTORS, SECTOR_LABELS, isDataSector } from '../../lib/sectorTables'
import { YEAR_START, TODAY, inDateRange, computeStats, fetchSectorRows } from '../../lib/reportStats'
import AuditReportSnapshot from '../../components/reports/AuditReportSnapshot'

export default function EncoderAuditReports() {
  const { session, profile, accountType } = useAuth()
  const { sector } = useSector()

  const [dateFrom, setDateFrom] = useState(YEAR_START)
  const [dateTo, setDateTo] = useState(TODAY)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null) // { stats, sector, dateFrom, dateTo }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  const isEncoder = accountType === 'encoder'

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) return
    setHistoryLoading(true)
    const { data, error: fetchError } = await supabase
      .from('audit_reports')
      .select('*')
      .eq('generated_by', session.user.id)
      .order('submitted_at', { ascending: false })
    if (!fetchError) setHistory(data || [])
    setHistoryLoading(false)
  }, [session?.user?.id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function handleGenerate() {
    setError('')
    setNotice('')
    setGenerating(true)
    const sectorsToLoad = sector === 'mbdevco' ? DATA_SECTORS : isDataSector(sector) ? [sector] : []
    const perSector = await Promise.all(sectorsToLoad.map(fetchSectorRows))
    const rows = inDateRange(perSector.flat(), dateFrom, dateTo)
    setPreview({ stats: computeStats(rows), sector, dateFrom, dateTo })
    setGenerating(false)
  }

  async function handleSubmit() {
    if (!preview) return
    setSubmitting(true)
    setError('')
    const { error: insertError } = await supabase.from('audit_reports').insert({
      sector: preview.sector,
      date_from: preview.dateFrom || null,
      date_to: preview.dateTo || null,
      stats: preview.stats,
      generated_by: session.user.id,
      generated_by_name: profile?.full_name || session.user.email,
    })
    if (insertError) {
      setError('We could not submit this report. Please try again.')
    } else {
      setNotice('Report submitted. Your supervisor/admin can now view it.')
      setPreview(null)
      await fetchHistory()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit Reports</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Generate a snapshot of your Dashboard figures and submit it for review.
        </p>
      </div>

      {!isEncoder && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Report generation is limited to Encoding accounts. If you need a copy of the latest
          report, ask your supervisor or admin.
        </div>
      )}

      {isEncoder && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div
                title="Range of dates executed to include"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <Calendar size={16} className="shrink-0 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[132px] bg-transparent text-sm text-slate-700 focus:outline-none"
                />
                <span className="text-slate-300">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[132px] bg-transparent text-sm text-slate-700 focus:outline-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                <FileText size={15} />
                {generating ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Sector: <strong className="text-slate-600">{SECTOR_LABELS[sector] || sector}</strong> — same figures as your Dashboard.
            </p>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

          {preview && (
            <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Preview — not yet submitted</p>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Discard preview"
                >
                  <X size={16} />
                </button>
              </div>
              <AuditReportSnapshot stats={preview.stats} meta={{ sector: preview.sector, dateFrom: preview.dateFrom, dateTo: preview.dateTo }} />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
              >
                <Send size={15} />
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          )}
        </>
      )}

      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-slate-700">My submitted reports</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">Submitted</th>
                <th className="px-4 py-2.5 text-left font-medium">Sector</th>
                <th className="px-4 py-2.5 text-left font-medium">Covers</th>
                <th className="px-4 py-2.5 text-right font-medium">Total Records</th>
                <th className="px-4 py-2.5 text-right font-medium">Total Billed</th>
                <th className="px-4 py-2.5 text-right font-medium">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyLoading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No reports submitted yet.</td></tr>
              ) : history.map(report => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{new Date(report.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{SECTOR_LABELS[report.sector] || report.sector}</td>
                  <td className="px-4 py-2.5 text-slate-600">{report.date_from || '…'} – {report.date_to || '…'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{report.stats?.total ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    ₱{(report.stats?.totalBilled || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setViewing(report)} className="text-sm font-medium text-blue-600 hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
