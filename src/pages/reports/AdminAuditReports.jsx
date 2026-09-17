import { AlertTriangle } from 'lucide-react'
import SubmittedReportsList from '../../components/reports/SubmittedReportsList'
import { overdueCriticalOf } from '../../lib/reportStats'
import { useSettings } from '../../lib/SettingsContext'

export default function AdminAuditReports() {
  // The threshold is a System Settings value, so the wording follows it
  // rather than naming a number the settings page can change.
  const { criticalDays } = useSettings()

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Reports submitted by Encoding accounts, across all sectors. Rows with
            overdue (&gt;{criticalDays} day) records are flagged.
          </p>
        </div>
        <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2E2E2E]">
          Admin
        </span>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Reports highlighted below have field orders overdue by more than {criticalDays} days
          — worth a closer look before sign-off.
        </p>
      </div>

      <SubmittedReportsList rowHighlight={report => overdueCriticalOf(report.stats) > 0} />
    </div>
  )
}
