// Shared by Dashboard.jsx and the Audit Reports pages, so a generated
// report always contains exactly the figures the Dashboard is already
// showing — one calculation, not two copies that can drift apart.
import { supabase } from './supabase'
import { fieldOrdersTable } from './sectorTables'
import { isOverdueBy } from './aging'

export const FO_COLUMNS =
  'status_crew, fo_type, fo_action, for_batch, billed_amount, crew_name, ' +
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
    if (!row.date_executed) return false
    if (from && row.date_executed < from) return false
    if (to && row.date_executed > to) return false
    return true
  })
}

export function computeStats(list) {
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

// Fetch one sector's field_orders rows, tagged with the sector they came
// from. A failed sector must not blank out the whole dashboard/report.
export async function fetchSectorRows(sector) {
  const { data, error } = await supabase
    .from(fieldOrdersTable(sector))
    .select(FO_COLUMNS)
    .order('seq', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`Failed to load ${sector} field orders:`, error)
    return []
  }
  return (data || []).map(row => ({ ...row, __sector: sector }))
}
