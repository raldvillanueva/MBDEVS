// The default until System Settings loads, and the fallback if it cannot be
// read at all.
const OVERDUE_THRESHOLD_DAYS = 21
const WARNING_THRESHOLD_DAYS = 10

// isOverdue() is called from module-level column definitions, where a React
// hook cannot reach, so the configured value is pushed in here once by
// SettingsProvider instead of being passed down through every call site.
let overdueThresholdDays = OVERDUE_THRESHOLD_DAYS
let warningThresholdDays = WARNING_THRESHOLD_DAYS

export function setOverdueThreshold(days) {
  if (Number(days) > 0) overdueThresholdDays = Number(days)
}

export function setWarningThreshold(days) {
  if (Number(days) > 0) warningThresholdDays = Number(days)
}

// date_executed comes from Postgres as "YYYY-MM-DD". Parse it as a UTC
// calendar date and compare against "today" also expressed in UTC
// calendar terms, to avoid the new Date("YYYY-MM-DD") UTC-parse vs.
// new Date() local-parse timezone mismatch (matters for PH/UTC+8).
export function computeAgingDays(dateExecuted) {
  if (!dateExecuted) return null
  const [y, m, d] = String(dateExecuted).split('-').map(Number)
  if (!y || !m || !d) return null
  const executedUTC = Date.UTC(y, m - 1, d)
  const now = new Date()
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((todayUTC - executedUTC) / 86400000)
}

// "ALREADY BATCH" means the meter has been returned, so the record stops
// aging: it reads as 0 days and can never be overdue.
export function isAlreadyBatched(row) {
  return !!row?.for_batch?.toUpperCase().includes('ALREADY')
}

export function displayAgingDays(row) {
  if (!row) return null
  if (isAlreadyBatched(row)) return 0
  return computeAgingDays(row.date_executed)
}

export function isOverdueBy(row, thresholdDays) {
  if (!row) return false
  if (isAlreadyBatched(row)) return false
  const days = computeAgingDays(row.date_executed)
  if (days == null) return false
  return days > thresholdDays && !row.date_returned
}

export function isOverdue(row) {
  return isOverdueBy(row, overdueThresholdDays)
}

/**
 * Which band a row's aging falls in, so the table can colour it without
 * asking the same question three times:
 *
 *   null       under the warning threshold, or not ageing at all
 *   'warning'  at or past the warning threshold (10 days) — yellow
 *   'critical' past the overdue threshold (21 days) — red
 *
 * A batched or returned meter is in no band: it has come back, so it has
 * stopped ageing and cannot be late.
 */
export function agingLevel(row) {
  if (!row || isAlreadyBatched(row) || row.date_returned) return null
  const days = computeAgingDays(row.date_executed)
  if (days == null) return null
  if (days > overdueThresholdDays) return 'critical'
  if (days >= warningThresholdDays) return 'warning'
  return null
}

/**
 * Days left on the witnessing clock, counting down from the overdue
 * threshold: the day witnessing happens there are 21 left, and it ticks
 * down one a day from there. Zero or below means the window has passed.
 *
 * Returns null when there is no witness date — nothing has started, so
 * there is nothing to count.
 */
export function dueDaysLeft(row) {
  if (!row?.witness_date) return null
  const elapsed = computeAgingDays(row.witness_date)
  if (elapsed == null) return null
  return overdueThresholdDays - elapsed
}

/**
 * Green while there is room, red once the remaining days drop into the
 * same stretch that turns aging yellow — so both columns change colour
 * at the same point in the 21-day window rather than on separate rules.
 */
export function dueLevel(row) {
  const left = dueDaysLeft(row)
  if (left == null) return null
  return left > (overdueThresholdDays - warningThresholdDays) ? 'ok' : 'due'
}

export { OVERDUE_THRESHOLD_DAYS, WARNING_THRESHOLD_DAYS }
