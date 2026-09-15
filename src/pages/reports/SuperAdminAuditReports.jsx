import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SubmittedReportsList from '../../components/reports/SubmittedReportsList'

function RollupCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#D9D9D9] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#2E2E2E]">{value}</p>
    </div>
  )
}

export default function SuperAdminAuditReports() {
  const [rollup, setRollup] = useState(null)

  useEffect(() => {
    async function loadRollup() {
      const { data } = await supabase.from('audit_reports').select('sector, stats')
      if (!data) return
      const bySector = new Set(data.map(r => r.sector))
      const totalBilled = data.reduce((sum, r) => sum + (r.stats?.totalBilled || 0), 0)
      setRollup({ count: data.length, sectors: bySector.size, totalBilled })
    }
    loadRollup()
  }, [])

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">Every report submitted, across every sector.</p>
        </div>
        <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Super Admin
        </span>
      </div>

      {rollup && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RollupCard label="Reports Submitted" value={rollup.count} />
          <RollupCard label="Sectors Covered" value={rollup.sectors} />
          <RollupCard label="Total Billed (all reports)" value={`₱${rollup.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
        </div>
      )}

      <SubmittedReportsList />
    </div>
  )
}
