import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  PackageCheck, Layers, AlertTriangle, Calendar, X, RotateCcw
} from 'lucide-react'
import { isOverdueBy } from '../lib/aging'
import { useSector } from '../lib/SectorContext'
import { DATA_SECTORS, SECTOR_LABELS, fieldOrdersTable, isDataSector } from '../lib/sectorTables'

function Section({ title, children }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  )
}

function StatCard({ label, value, icon: Icon, tint, sub, wide }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
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

// The FO Action split lives in a single divided panel rather than four separate
// cards, so it reads as one breakdown instead of another row of headlines.
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

// A field order still needs crew action while it is neither completed nor cancelled.
function isPendingTask(row) {
  const status = row.status_crew?.toUpperCase() || ''
  return !row.archived_at && !status.includes('FIELD') && !status.includes('CANCEL')
}

// Local calendar date as "YYYY-MM-DD", matching the format date inputs and
// Postgres date columns both use.
function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const SUMMARY_SECTORS = [
  { key: 'all', label: 'All sectors' },
  ...DATA_SECTORS.map(key => ({ key, label: SECTOR_LABELS[key] })),
]

const FO_COLUMNS =
  'status_crew, fo_type, fo_action, for_batch, billed_amount, crew_name, ' +
  'field_order_no, location, created_at, seq, date_assign, date_executed, ' +
  'date_returned, archived_at'

// Each sector lives in its own table, so rows are tagged with the table they
// came from as they are loaded. Nothing infers a sector from row contents.
function rowSector(row) {
  return row.__sector
}

const YEAR_START = `${new Date().getFullYear()}-01-01`
const TODAY = toISODate(new Date())

// date_executed is a plain "YYYY-MM-DD" string, so the range check is a direct
// string comparison against the date inputs (same format).
function inDateRange(rows, from, to) {
  if (!from && !to) return rows
  return rows.filter(row => {
    if (!row.date_executed) return false
    if (from && row.date_executed < from) return false
    if (to && row.date_executed > to) return false
    return true
  })
}

function computeStats(list) {
  const status = row => row.status_crew?.toUpperCase() || ''
  const action = row => row.fo_action?.toUpperCase() || ''

  return {
    total: list.length,
    assigned: list.filter(r => ['ASSIGNED', 'REASSIGN'].includes(status(r))).length,
    fieldComplete: list.filter(r => status(r).includes('FIELD')).length,
    cancelled: list.filter(r => status(r).includes('CANCEL')).length,
    totalBilled: list.reduce((sum, r) => sum + (parseFloat(r.billed_amount) || 0), 0),

    overdue10: list.filter(r => !r.archived_at && isOverdueBy(r, 10)).length,
    overdue21: list.filter(r => !r.archived_at && isOverdueBy(r, 21)).length,
    batched: list.filter(r => r.for_batch?.toUpperCase().includes('ALREADY')).length,

    replacement: list.filter(r => action(r) === 'REPLACE FO').length,
    retirement: list.filter(r => action(r) === 'RETIREMENT FO').length,
    energize: list.filter(r => action(r) === 'ENERGIZED FO').length,
    others: list.filter(r => action(r) === 'OTHERS').length,
  }
}

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(YEAR_START)
  const [dateTo, setDateTo] = useState(TODAY)
  const navigate = useNavigate()
  const { sector } = useSector()
  // MBDEVCO sees a read-only rollup: no links out to the record pages.
  const isSummaryOnly = sector === 'mbdevco'
  const [summarySector, setSummarySector] = useState('all')

  useEffect(() => {
    // The MBDEVCO rollup reads every sector table; a normal sector reads
    // only its own. Each row is tagged so the breakdown can group them.
    const sectorsToLoad = isSummaryOnly
      ? DATA_SECTORS
      : isDataSector(sector) ? [sector] : []

    async function fetchData() {
      const perSector = await Promise.all(sectorsToLoad.map(async key => {
        const { data, error } = await supabase
          .from(fieldOrdersTable(key))
          .select(FO_COLUMNS)
          .order('seq', { ascending: true, nullsFirst: true })
          .order('created_at', { ascending: false })

        if (error) {
          // One missing sector table must not blank the whole dashboard.
          console.error(`Failed to load ${key} field orders:`, error)
          return []
        }
        return (data || []).map(row => ({ ...row, __sector: key }))
      }))

      setRows(perSector.flat())
      setLoading(false)
    }
    fetchData()
  }, [isSummaryOnly, sector])

  // Which sector's records this page is summarising. On the MBDEVCO rollup the
  // user picks it ('all' means every sector); anywhere else it is the sector
  // that was chosen at sign-in, so e.g. Rizal shows Rizal's records only and
  // never an all-sector total.
  const scope = isSummaryOnly ? summarySector : sector
  const scopeLabel =
    SUMMARY_SECTORS.find(option => option.key === scope)?.label ||
    (scope ? scope.charAt(0).toUpperCase() + scope.slice(1) : 'All sectors')

  const sectorRows = useMemo(() => {
    if (scope === 'all' || !scope) return rows
    return rows.filter(row => rowSector(row) === scope)
  }, [rows, scope])

  const filtered = useMemo(
    () => inDateRange(sectorRows, dateFrom, dateTo),
    [sectorRows, dateFrom, dateTo],
  )

  const stats = useMemo(() => computeStats(filtered), [filtered])

  // Per-sector figures for the breakdown table. Date-filtered like everything
  // else, but never sector-filtered, so each sector is always listed — a sector
  // with no records shows zeros rather than disappearing.
  const bySector = useMemo(() => {
    const dated = inDateRange(rows, dateFrom, dateTo)
    return SUMMARY_SECTORS
      .filter(option => option.key !== 'all')
      .map(option => ({
        ...option,
        stats: computeStats(dated.filter(row => rowSector(row) === option.key)),
      }))
  }, [rows, dateFrom, dateTo])

  // Deliberately built from every row, not the date-filtered set: a pending
  // task has not been executed yet, so it has no date_executed and any
  // execution-date range would always exclude it.
  const pendingTasks = useMemo(() => rows.filter(isPendingTask), [rows])
  const todo = pendingTasks.slice(0, 8)
  const isFiltered = !!(dateFrom || dateTo)
  const isDefaultRange = dateFrom === YEAR_START && dateTo === TODAY

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              {isSummaryOnly ? 'MBDEVCO Summary' : 'Dashboard'}
            </h1>
            {/* Always name the sector being shown — with an "All sectors"
                filter the figures alone give no clue what they cover. */}
            <span className="rounded-full bg-[#D89B00]/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#8A6400]">
              {scopeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {isSummaryOnly
              ? scope === 'all'
                ? 'Read-only overview — every sector combined'
                : `Read-only overview — ${scopeLabel} sector only`
              : `Field order activity for ${scopeLabel}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSummaryOnly && (
            <select
              value={summarySector}
              onChange={e => setSummarySector(e.target.value)}
              title="Choose which sector to summarise"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SUMMARY_SECTORS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          )}
          <div
            title="Filter by date executed"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
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
            {isFiltered && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                title="Clear date filter (show all time)"
                className="ml-0.5 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {!isDefaultRange && (
            <button
              onClick={() => { setDateFrom(YEAR_START); setDateTo(TODAY) }}
              title={`Back to ${YEAR_START} – ${TODAY}`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <RotateCcw size={13} />
              This year
            </button>
          )}

          {isFiltered && (
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <strong className="font-semibold">{filtered.length}</strong> of {sectorRows.length}
            </span>
          )}
        </div>
      </div>

      {scope !== 'all' && sectorRows.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          No records for{' '}
          <strong className="font-semibold text-slate-700">
            {SUMMARY_SECTORS.find(option => option.key === scope)?.label || scope}
          </strong>{' '}
          yet — every figure below is zero.
        </div>
      )}

      <Section title="Status">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Assigned" value={stats.assigned} icon={ClipboardList} tint="bg-blue-50 text-blue-600" />
          <StatCard label="Field Complete" value={stats.fieldComplete} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
          <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} tint="bg-rose-50 text-rose-600" />
          <StatCard
            label="Total Billed"
            value={`₱${stats.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
            icon={PackageCheck}
            tint="bg-violet-50 text-violet-600"
            wide
          />
        </div>
      </Section>

      <Section title="Needs attention">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StatCard
            label="Overdue (>10 days)"
            value={stats.overdue10}
            icon={Clock}
            tint="bg-amber-50 text-amber-600"
            sub="Meter not yet returned"
          />
          <StatCard
            label="Overdue (>21 days)"
            value={stats.overdue21}
            icon={AlertTriangle}
            tint="bg-red-50 text-red-600"
            sub="Meter not yet returned"
          />
          <StatCard
            label="Already Batched"
            value={stats.batched}
            icon={Layers}
            tint="bg-teal-50 text-teal-600"
            sub="Counted as returned"
          />
        </div>
      </Section>

      <Section title="By FO Action">
        <FoActionPanel stats={stats} />
      </Section>

      {isSummaryOnly && (
      <Section title="By sector">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">Sector</th>
                <th className="px-4 py-2.5 text-right font-medium">Records</th>
                <th className="px-4 py-2.5 text-right font-medium">Assigned</th>
                <th className="px-4 py-2.5 text-right font-medium">Field Complete</th>
                <th className="px-4 py-2.5 text-right font-medium">Cancelled</th>
                <th className="px-4 py-2.5 text-right font-medium">Overdue (&gt;21)</th>
                <th className="px-4 py-2.5 text-right font-medium">Total Billed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bySector.map(entry => {
                const isEmpty = entry.stats.total === 0
                const isPicked = scope === entry.key
                return (
                  <tr
                    key={entry.key}
                    className={`transition-colors ${isPicked ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {entry.label}
                      {isPicked && (
                        <span className="ml-2 rounded-full bg-[#D89B00]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#8A6400]">
                          Showing
                        </span>
                      )}
                    </td>
                    {isEmpty ? (
                      <td colSpan={6} className="px-4 py-2.5 text-right text-slate-400">
                        No records
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{entry.stats.total}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{entry.stats.assigned}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{entry.stats.fieldComplete}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{entry.stats.cancelled}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${entry.stats.overdue21 > 0 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                          {entry.stats.overdue21}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                          {`₱${entry.stats.totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
      )}

      {!isSummaryOnly && (
      <Section title="To-Do List">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-700">Pending tasks</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    pendingTasks.length > 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {pendingTasks.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Not yet completed or cancelled</p>
            </div>
            {!isSummaryOnly && (
              <button
                onClick={() => navigate('/field-orders')}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View all
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 text-left font-medium">Field Order</th>
                  <th className="px-5 py-2.5 text-left font-medium">Crew</th>
                  <th className="px-5 py-2.5 text-left font-medium">Location</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                  <th className="px-5 py-2.5 text-left font-medium">FO Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todo.map((row, i) => (
                  <tr key={i} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-slate-700">{row.field_order_no || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{row.crew_name || '—'}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-slate-600">{row.location || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.status_crew} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.fo_action || '—'}</td>
                  </tr>
                ))}
                {todo.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                      No pending tasks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const s = status?.toUpperCase() || ''
  if (s === 'CANCEL') return <span className="rounded px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-700">CANCEL</span>
  if (s.includes('FIELD')) return <span className="rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">FIELD COMPL.</span>
  return <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">{status || '—'}</span>
}
