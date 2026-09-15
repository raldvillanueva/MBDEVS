import SubmittedReportsList from '../../components/reports/SubmittedReportsList'

export default function AdminAuditReports() {
  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">Reports submitted by Encoding accounts, across all sectors.</p>
        </div>
        <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#2E2E2E]">
          Admin
        </span>
      </div>
      <SubmittedReportsList />
    </div>
  )
}
