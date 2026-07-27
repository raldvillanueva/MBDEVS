const OVERDUE_THRESHOLD_DAYS = 21

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

export function isOverdue(row) {
  if (!row) return false
  const days = computeAgingDays(row.date_executed)
  if (days == null) return false
  return days > OVERDUE_THRESHOLD_DAYS && !row.date_returned
}

export { OVERDUE_THRESHOLD_DAYS }
