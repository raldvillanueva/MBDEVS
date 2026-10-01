// Shared by Dashboard.jsx and the Audit Reports pages, so a generated
// report always contains exactly the figures the Dashboard is already
// showing — one calculation, not two copies that can drift apart.
import { supabase } from './supabase'
import { fieldOrdersTable, pendingOrdersTable } from './sectorTables'
import { isOverdueBy } from './aging'

export const FO_COLUMNS =
  // id is selected because paging orders by it to break ties; ordering by a
  // column that is not selected is allowed, but relying on that is a
  // needless thing to be wrong about.
  'id, status_crew, fo_type, fo_action, for_batch, billed_amount, crew_name, ' +
  'field_order_no, location, created_at, seq, date_assign, date_executed, ' +
  'date_returned, archived_at'

// Local calendar date as "YYYY-MM-DD", matching the format date inputs and
// Postgres date columns both use.
export function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const YEAR_START = `${new Date().getFullYear()}-01-01`
export const TODAY = toISODate(new Date())

// date_executed is a plain "YYYY-MM-DD" string, so the range check is a direct
// string comparison against the date inputs (same format).
export function inDateRange(rows, from, to) {
  if (!from && !to) return rows
  return rows.filter(row => {
    // Date executed is the right date to place a job by, but an assigned
    // job that has not been done yet does not have one — and most imported
    // rows carry only the assignment date. Dropping those made the whole
    // Dashboard read zero while the table held thousands of records, so
    // fall back to the assignment date.
    const when = row.date_executed || row.date_assign

    // Neither date means the record cannot be placed in time at all. It is
    // still a real record, so it is counted rather than hidden: a figure
    // that silently omits rows is worse than one that includes an undated
    // few.
    if (!when) return true

    if (from && when < from) return false
    if (to && when > to) return false
    return true
  })
}

// The two overdue day counts are a System Settings value, so they arrive from
// the caller. The defaults match what the app used before they were editable,
// which keeps callers that don't care about them working unchanged.
// A job with a crew on it. The same rule wherever the question is asked —
// a pending record and a filed one count the same way.
export function isAssigned(row) {
  return ['ASSIGNED', 'REASSIGN'].includes(row?.status_crew?.toUpperCase() || '')
}

export function computeStats(list, { warningDays = 10, criticalDays = 21 } = {}) {
  const status = row => row.status_crew?.toUpperCase() || ''
  const action = row => row.fo_action?.toUpperCase() || ''

  return {
    total: list.length,
    assigned: list.filter(isAssigned).length,
    fieldComplete: list.filter(r => status(r).includes('FIELD')).length,
    cancelled: list.filter(r => status(r).includes('CANCEL')).length,
    totalBilled: list.reduce((sum, r) => sum + (parseFloat(r.billed_amount) || 0), 0),

    overdueWarning: list.filter(r => !r.archived_at && isOverdueBy(r, warningDays)).length,
    overdueCritical: list.filter(r => !r.archived_at && isOverdueBy(r, criticalDays)).length,
    // Saved with the report so a snapshot can label itself with the days that
    // were in force when it was taken, not whatever they are now.
    thresholds: { warningDays, criticalDays },
    batched: list.filter(r => r.for_batch?.toUpperCase().includes('ALREADY')).length,

    replacement: list.filter(r => action(r) === 'REPLACE FO').length,
    retirement: list.filter(r => action(r) === 'RETIREMENT FO').length,
    energize: list.filter(r => action(r) === 'ENERGIZED FO').length,
    // Everything else, rather than only the literal word "Others". A new
    // FO Action used to count towards no tile at all, so the four
    // numbers silently stopped adding up to the total.
    others: list.filter(r => {
      const a = action(r)
      return a !== '' && !['REPLACE FO', 'RETIREMENT FO', 'ENERGIZED FO'].includes(a)
    }).length,
  }
}

// Reports saved before the thresholds became editable stored the counts as
// overdue10/overdue21 and carried no thresholds at all. These readers keep
// those older rows rendering correctly alongside new ones.
export function overdueWarningOf(stats) {
  return stats?.overdueWarning ?? stats?.overdue10 ?? 0
}

export function overdueCriticalOf(stats) {
  return stats?.overdueCritical ?? stats?.overdue21 ?? 0
}

export function thresholdsOf(stats) {
  return { warningDays: 10, criticalDays: 21, ...(stats?.thresholds || {}) }
}

// Fetch one sector's field_orders rows, tagged with the sector they came
// from. A failed sector must not blank out the whole dashboard/report.
// PostgREST returns at most 1,000 rows per request and says nothing about
// the rest. Without paging, every figure on the Dashboard was computed from
// the first thousand records and presented as the total — wrong, and wrong
// in a way nothing on screen would reveal.
//
// A hard stop so a runaway loop cannot hang the page. Well past any sector's
// real size; if it is ever reached the console says so rather than the page
// quietly going back to under-reporting.
const MAX_ROWS = 100000
const PAGE = 1000

// Only what the Assigned tile needs. A pending record is not a field order
// and is not folded into the rest of the figures — it is counted for this
// one question and nothing else.
const PENDING_COLUMNS = 'id, status_crew, date_assign, date_executed'

export async function fetchSectorPendingRows(sector) {
  const { data, error } = await supabase
    .from(pendingOrdersTable(sector))
    .select(PENDING_COLUMNS)

  if (error) {
    console.error(`Failed to load ${sector} pending orders:`, error)
    return []
  }
  return (data || []).map(row => ({ ...row, __sector: sector }))
}

export async function fetchSectorRows(sector) {
  const table = fieldOrdersTable(sector)
  const all = []

  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(FO_COLUMNS)
      .order('seq', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      // id breaks ties. Without it, rows sharing a seq and a created_at come
      // back in no fixed order and could repeat or vanish between pages.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error(`Failed to load ${sector} field orders:`, error)
      // Whatever arrived before the failure, rather than nothing.
      break
    }
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < PAGE) break
  }

  if (all.length >= MAX_ROWS) {
    console.warn(`${sector}: stopped at ${MAX_ROWS} rows; totals are understated`)
  }

  return all.map(row => ({ ...row, __sector: sector }))
}
