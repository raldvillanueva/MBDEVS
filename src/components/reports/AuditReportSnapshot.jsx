import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  PackageCheck, Layers, AlertTriangle,
} from 'lucide-react'
import { SECTOR_LABELS } from '../../lib/sectorTables'
import { overdueWarningOf, overdueCriticalOf, thresholdsOf } from '../../lib/reportStats'

function StatCard({ label, value, icon: Icon, tint, sub, wide }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon size={15} />
        </span>
        <p className="text-sm leading-snug text-slate-500">{label}</p>
      </div>
      <p className={`mt-1.5 font-bold tabular-nums tracking-tight text-slate-800 ${wide ? 'text-lg' : 'text-xl'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

const FO_ACTION_TILES = [
  { key: 'replacement', label: 'Replacement FO', dot: 'bg-amber-500' },
  { key: 'retirement', label: 'Retirement FO', dot: 'bg-slate-400' },
  { key: 'energize', label: 'Energize FO', dot: 'bg-yellow-500' },
  { key: 'others', label: 'Others', dot: 'bg-indigo-500' },
]

function FoActionPanel({ stats }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4">
      {FO_ACTION_TILES.map((tile, i) => (
        <div
          key={tile.key}
          className={[
            'px-4 py-3 border-slate-100',
            i % 2 === 1 ? 'border-l' : '',
            i >= 2 ? 'border-t' : '',
            'sm:border-t-0',
            i > 0 ? 'sm:border-l' : 'sm:border-l-0',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${tile.dot}`} />
            <p className="truncate text-sm text-slate-500">{tile.label}</p>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-slate-800">
            {stats[tile.key]}
          </p>
        </div>
      ))}
    </div>
  )
}

function money(n) {
  return `₱${(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

// Renders one report's figures — identical shape to the Dashboard's Status /
// Needs attention / By FO Action sections, since a report is a snapshot of
// exactly that. `meta` carries who/when/what-sector, shown above the figures.
export default function AuditReportSnapshot({ stats, meta }) {
  // A snapshot is a record of a moment, so it labels itself with the day
  // counts that were in force then — not the ones set today.
  const days = thresholdsOf(stats)

  return (
    <div className="space-y-4">
      {meta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {meta.sector && (
            <span><strong className="font-semibold text-slate-800">Sector:</strong> {SECTOR_LABELS[meta.sector] || meta.sector}</span>
          )}
          {(meta.dateFrom || meta.dateTo) && (
            <span><strong className="font-semibold text-slate-800">Covers:</strong> {meta.dateFrom || '…'} – {meta.dateTo || '…'}</span>
          )}
          {meta.submittedBy && (
            <span><strong className="font-semibold text-slate-800">Submitted by:</strong> {meta.submittedBy}</span>
          )}
          {meta.submittedAt && (
            <span><strong className="font-semibold text-slate-800">Submitted:</strong> {new Date(meta.submittedAt).toLocaleString()}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned" value={stats.assigned} icon={ClipboardList} tint="bg-blue-50 text-blue-600" />
        <StatCard label="Field Complete" value={stats.fieldComplete} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tint="bg-rose-50 text-rose-600" />
        <StatCard label="Total Billed" value={money(stats.totalBilled)} icon={PackageCheck} tint="bg-violet-50 text-violet-600" wide />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={`Overdue (>${days.warningDays} days)`} value={overdueWarningOf(stats)} icon={Clock} tint="bg-amber-50 text-amber-600" sub="Meter not yet returned" />
        <StatCard label={`Overdue (>${days.criticalDays} days)`} value={overdueCriticalOf(stats)} icon={AlertTriangle} tint="bg-red-50 text-red-600" sub="Meter not yet returned" />
        <StatCard label="Already Batched" value={stats.batched} icon={Layers} tint="bg-teal-50 text-teal-600" sub="Counted as returned" />
      </div>

      <FoActionPanel stats={stats} />
    </div>
  )
}
