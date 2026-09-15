import { AlertTriangle } from 'lucide-react'
import SubmittedReportsList from '../../components/reports/SubmittedReportsList'

export default function SupervisorAuditReports() {
  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review submitted reports. Rows with overdue (&gt;21 day) records are flagged.
          </p>
        </div>
        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Supervisor
        </span>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>Reports highlighted below have field orders overdue by more than 21 days — worth a closer look before sign-off.</p>
      </div>

      <SubmittedReportsList rowHighlight={report => (report.stats?.overdue21 || 0) > 0} />
    </div>
  )
}
