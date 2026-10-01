// Search and filters for Field Orders, Pending Records and Archived Work
// Orders — one description of "what am I looking for", applied two ways:
//
//   applyFiltersToQuery(q, filters)   Field Orders / Archived: the database
//                                     does the filtering (only a page of
//                                     rows is ever loaded).
//   rowMatchesFilters(row, filters)   Pending Records: every pending row is
//                                     already in the browser.
//
// Both read the same object, which is also exactly what a saved filter
// stores:
//
//   {
//     search:   'text to look for',
//     searchIn: ['field_order_no', ...]     // empty = every text column
//     values:   { job_description: ['REPLACE', 'RETIRE'], ... }
//                                           // ticked values per column;
//                                           // BLANK means "no value"
//     rules:    [{ id, field, op, value, value2 }]
//                                           // "+ Add filter" conditions
//     year:     'All' | '2025',  month: 'All' | 'March'
//   }
//
// Columns within one filter are OR (REPLACE or RETIRE); different filters
// are AND (REPLACE and crew J. BITAGO).

import { computeAgingDays } from './aging'

export const BLANK = '__blank__'

export const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Every column a person might want to search or filter by.
//   type   text | number | date | bool | aging (worked out from Date Executed)
//   pages  limit to some pages (fo_action only exists on Pending)
export const FILTER_FIELDS = [
  { key: 'field_order_no',         label: 'Field Order/FO',        type: 'text' },
  // New columns: only there once the database has been updated
  // (lib/optionalColumns.js). Pages pass them as `missing` until then.
  { key: 'submitted_to',           label: 'Submitted To',          type: 'text', list: true },
  { key: 'date_submitted',         label: 'Date of Submitted',     type: 'date' },
  { key: 'job_description',        label: 'Job Description',       type: 'text', list: true },
  { key: 'crew_name',              label: 'Crew Name',             type: 'text', list: true },
  { key: 'status_crew',            label: 'Status Crew',           type: 'text', list: true },
  { key: 'fo_action',              label: 'FO Action',             type: 'text', list: true, pages: ['pending'] },
  { key: 'date_executed',          label: 'Date Executed',         type: 'date' },
  { key: 'for_check',              label: 'Check',                 type: 'bool' },
  { key: 'date_assign',            label: 'Date Assign',           type: 'date' },
  { key: 'type_of_meter',          label: 'Type of Meter',         type: 'text', list: true },
  { key: 'service_number',         label: 'Service ID Number',     type: 'text' },
  { key: 'remove_meter',           label: 'Remove Meter',          type: 'text' },
  { key: 'r_serial_number',        label: 'R. Serial Number',      type: 'text' },
  { key: 'demand_seal_aerolock',   label: 'Demand Seal No.5',      type: 'text' },
  { key: 'removed_seal',           label: 'Removed Seal',          type: 'text' },
  { key: 'cabinet_seal_remove',    label: 'Cabinet Seal (Remove)', type: 'text' },
  { key: 'reading_kwh',            label: 'Reading (kWh)',         type: 'text' },
  { key: 'demand_kwh_cum',         label: 'Demand/Cum (kWh)',      type: 'text', pages: ['field_orders', 'archived'], notByDefault: true },
  { key: 'ins_meter',              label: 'Installed Meter',       type: 'text' },
  { key: 'ins_serial_number',      label: 'Ins. Serial Number',    type: 'text' },
  { key: 'demand_seal_installed',  label: 'Demand Seal (5)',       type: 'text' },
  { key: 'installed_seal',         label: 'Installed Seal (1)',    type: 'text' },
  { key: 'cabinet_seal_installed', label: 'Cabinet Seal (Installed)', type: 'text' },
  { key: 'tln_tag',                label: 'TLN Tag',               type: 'text' },
  { key: 'pole_tag',               label: 'Pole Tag',              type: 'text' },
  { key: 'booba_number',           label: 'Booba Number',          type: 'text' },
  { key: 'mdltr_no',               label: 'MDLTR No.',             type: 'text' },
  { key: 'aging_days',             label: 'Aging (days since executed)', type: 'aging' },
  { key: 'witness_date',           label: 'Witness Date',          type: 'date' },
  { key: 'remarks',                label: 'Remarks',               type: 'text' },
  { key: 'location',               label: 'Location',              type: 'text' },
  { key: 'mflt_checklist',         label: 'MFLT Checklist',        type: 'bool' },
  { key: 'fo_type',                label: 'FO Type',               type: 'text', list: true },
  { key: 'billed_amount',          label: 'Billed Amount',         type: 'number', list: true },
  { key: 'for_batch',              label: 'For Batch',             type: 'text', list: true },
  { key: 'date_returned',          label: 'Date Returned',         type: 'date' },
  { key: 'crew_payrol',            label: 'Crew Payroll',          type: 'number' },
  { key: 'percentage',             label: '%',                     type: 'text', pages: ['field_orders', 'archived'], notByDefault: true },
  { key: 'pluscode',               label: 'Pluscode',              type: 'text' },
  { key: 'plangrid',               label: 'PlanGrid',              type: 'text' },
  { key: 'archived_at',            label: 'Archived On',           type: 'date', pages: ['archived'] },
  { key: 'created_at',             label: 'Date Added',            type: 'date', pages: ['pending'] },
]

const FIELD_BY_KEY = Object.fromEntries(FILTER_FIELDS.map(f => [f.key, f]))

export function filterField(key) {
  return FIELD_BY_KEY[key]
}

export function fieldsForPage(page) {
  return FILTER_FIELDS.filter(f => !f.pages || f.pages.includes(page))
}

/** Text columns the search box can look in, for a page. */
export function searchableFields(page) {
  return fieldsForPage(page).filter(f => f.type === 'text')
}

// "All columns" in the search leaves out the notByDefault ones: they are
// readings rather than things anyone searches for, and they were added to
// the tables later, so an older sector table might not have them.
function defaultSearchKeys(page) {
  return searchableFields(page).filter(f => !f.notByDefault).map(f => f.key)
}

// The six the search box always used. Shown as the suggestion in the
// "Search in" picker; the default is now every text column.
export const CLASSIC_SEARCH_FIELDS = ['field_order_no', 'service_number', 'crew_name', 'location', 'remove_meter', 'ins_meter']

export const OPS = {
  text: [
    { op: 'contains',     label: 'contains' },
    { op: 'not_contains', label: 'does not contain' },
    { op: 'is',           label: 'is exactly' },
    { op: 'is_not',       label: 'is not' },
    { op: 'starts',       label: 'starts with' },
    { op: 'empty',        label: 'is empty',     noValue: true },
    { op: 'not_empty',    label: 'is not empty', noValue: true },
  ],
  number: [
    { op: 'eq',        label: '=' },
    { op: 'gt',        label: 'more than' },
    { op: 'lt',        label: 'less than' },
    { op: 'between',   label: 'between', two: true },
    { op: 'empty',     label: 'is empty',     noValue: true },
    { op: 'not_empty', label: 'is not empty', noValue: true },
  ],
  date: [
    { op: 'on',        label: 'on' },
    { op: 'before',    label: 'before' },
    { op: 'after',     label: 'after' },
    { op: 'between',   label: 'between', two: true },
    { op: 'empty',     label: 'is empty',     noValue: true },
    { op: 'not_empty', label: 'is not empty', noValue: true },
  ],
  bool: [
    { op: 'is_true',  label: 'is checked',     noValue: true },
    { op: 'is_false', label: 'is not checked', noValue: true },
  ],
  aging: [
    { op: 'gt',      label: 'more than' },
    { op: 'lt',      label: 'less than' },
    { op: 'between', label: 'between', two: true },
  ],
}

export function opsFor(fieldKey) {
  return OPS[filterField(fieldKey)?.type] || OPS.text
}

export function opSpec(fieldKey, op) {
  return opsFor(fieldKey).find(o => o.op === op)
}

export function emptyFilters() {
  return { search: '', searchIn: [], values: {}, rules: [], year: 'All', month: 'All' }
}

/** Fill in anything missing, drop anything malformed — saved filters may
 *  have been written by an older version of the page. */
export function normalizeFilters(raw) {
  const base = emptyFilters()
  if (!raw || typeof raw !== 'object') return base
  const values = {}
  for (const [k, v] of Object.entries(raw.values || {})) {
    if (FIELD_BY_KEY[k] && Array.isArray(v) && v.length) values[k] = v.map(String)
  }
  const rules = (Array.isArray(raw.rules) ? raw.rules : [])
    .filter(r => r && FIELD_BY_KEY[r.field] && opSpec(r.field, r.op))
    .map(r => ({
      id: String(r.id || Math.random().toString(36).slice(2)),
      field: r.field, op: r.op,
      value: r.value == null ? '' : String(r.value),
      value2: r.value2 == null ? '' : String(r.value2),
    }))
  return {
    search: typeof raw.search === 'string' ? raw.search : '',
    searchIn: Array.isArray(raw.searchIn) ? raw.searchIn.filter(k => FIELD_BY_KEY[k]) : [],
    values,
    rules,
    year: raw.year && raw.year !== 'All' ? String(raw.year) : 'All',
    month: raw.year && raw.year !== 'All' && raw.month ? String(raw.month) : 'All',
  }
}

/** A rule is only applied once it has what it needs. */
export function ruleIsComplete(rule) {
  const spec = opSpec(rule.field, rule.op)
  if (!spec) return false
  if (spec.noValue) return true
  if (String(rule.value ?? '').trim() === '') return false
  if (spec.two && String(rule.value2 ?? '').trim() === '') return false
  return true
}

export function activeFilterCount(filters) {
  const f = filters || emptyFilters()
  return (
    (f.search?.trim() ? 1 : 0) +
    Object.values(f.values || {}).filter(v => v?.length).length +
    (f.rules || []).filter(ruleIsComplete).length +
    (f.year && f.year !== 'All' ? 1 : 0)
  )
}

/** The same filters minus anything on the given columns — used so the
 *  record count, "Select all" and the chips all agree once a column's
 *  filter has been switched off. */
export function withoutColumns(filters, columns = []) {
  if (!columns.length) return filters
  const f = normalizeFilters(filters)
  const values = Object.fromEntries(Object.entries(f.values).filter(([k]) => !columns.includes(k)))
  return { ...f, values, rules: f.rules.filter(r => !columns.includes(r.field)) }
}

export function hasActiveFilters(filters) {
  return activeFilterCount(filters) > 0
}

// ── Period (Year / Month) ─────────────────────────────────────────────

// Inclusive [start, end] date_executed range. Month is only meaningful
// with a year, so it is ignored without one.
export function periodRange(year, month) {
  if (!year || year === 'All') return null
  const y = Number(year)
  if (!month || month === 'All') return [`${y}-01-01`, `${y}-12-31`]
  const m = MONTH_OPTIONS.indexOf(month) + 1
  if (m < 1) return [`${y}-01-01`, `${y}-12-31`]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`]
}

// ── Helpers ──────────────────────────────────────────────────────────

// Inside a PostgREST or=(...) a value is wrapped in double quotes so that
// commas, dots and brackets in it (a location like "A, B (Rizal)") are
// read as text, not as syntax.
function quote(s) {
  return `"${String(s).replace(/[\\"]/g, m => `\\${m}`)}"`
}

// % and _ are wildcards in LIKE; a value containing them is matched
// literally.
function likeEscape(s) {
  return String(s).replace(/[\\%_]/g, m => `\\${m}`)
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Aging more than N days" = executed before today minus N days. Same
// calendar-day arithmetic as computeAgingDays in aging.js.
function daysAgo(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - Number(n))
  return localDateStr(d)
}

function num(v) {
  const n = parseFloat(String(v).replace(/[₱,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

// ── Database side ────────────────────────────────────────────────────

/**
 * Apply search + filters to a supabase-js query builder.
 *   page         'field_orders' | 'archived'  (decides which columns exist)
 */
/**
 * Options shared by both appliers:
 *   missing   columns the table does not have yet — left out of everything,
 *             including the search, or the query would fail.
 *   disabled  columns the Super Admin switched filtering off for — their
 *             filters are ignored (also inside saved filters); the search
 *             box still looks in them.
 */
function skipper(page, missing = [], disabled = []) {
  const skip = new Set([...missing, ...disabled])
  return field => !field || (field.pages && !field.pages.includes(page)) || skip.has(field.key)
}

export function applyFiltersToQuery(q, filters, { page = 'field_orders', missing = [], disabled = [] } = {}) {
  const f = normalizeFilters(filters)
  const skip = skipper(page, missing, disabled)

  // Search
  const term = f.search.trim()
  if (term) {
    const available = searchableFields(page).map(x => x.key).filter(k => !missing.includes(k))
    const cols = (f.searchIn.length ? f.searchIn : defaultSearchKeys(page)).filter(k => available.includes(k))
    if (cols.length) {
      const pattern = quote(`%${likeEscape(term)}%`)
      q = q.or(cols.map(c => `${c}.ilike.${pattern}`).join(','))
    }
  }

  // Ticked values
  for (const [col, picked] of Object.entries(f.values)) {
    const field = FIELD_BY_KEY[col]
    if (skip(field)) continue
    const parts = []
    for (const v of picked) {
      if (v === BLANK) {
        parts.push(`${col}.is.null`)
        if (field.type === 'text') parts.push(`${col}.eq.""`)
      } else if (field.type === 'number') {
        const n = num(v)
        if (n != null) parts.push(`${col}.eq.${n}`)
      } else {
        parts.push(`${col}.ilike.${quote(likeEscape(v))}`)
      }
    }
    if (parts.length) q = q.or(parts.join(','))
  }

  // Rules
  for (const rule of f.rules) {
    if (!ruleIsComplete(rule)) continue
    const field = FIELD_BY_KEY[rule.field]
    if (skip(field)) continue
    q = applyRule(q, field, rule)
  }

  // Period
  const range = periodRange(f.year, f.month)
  if (range) q = q.gte('date_executed', range[0]).lte('date_executed', range[1])

  return q
}

function applyRule(q, field, rule) {
  const col = field.key
  const v = String(rule.value ?? '').trim()
  const v2 = String(rule.value2 ?? '').trim()

  switch (field.type) {
    case 'text':
      switch (rule.op) {
        case 'contains':     return q.or(`${col}.ilike.${quote(`%${likeEscape(v)}%`)}`)
        case 'not_contains': return q.or(`${col}.is.null,${col}.not.ilike.${quote(`%${likeEscape(v)}%`)}`)
        case 'is':           return q.or(`${col}.ilike.${quote(likeEscape(v))}`)
        case 'is_not':       return q.or(`${col}.is.null,${col}.not.ilike.${quote(likeEscape(v))}`)
        case 'starts':       return q.or(`${col}.ilike.${quote(`${likeEscape(v)}%`)}`)
        case 'empty':        return q.or(`${col}.is.null,${col}.eq.""`)
        case 'not_empty':    return q.not(col, 'is', null).neq(col, '')
        default:             return q
      }
    case 'number': {
      const a = num(v), b = num(v2)
      switch (rule.op) {
        case 'eq':        return a == null ? q : q.eq(col, a)
        case 'gt':        return a == null ? q : q.gt(col, a)
        case 'lt':        return a == null ? q : q.lt(col, a)
        case 'between':   return a == null || b == null ? q : q.gte(col, Math.min(a, b)).lte(col, Math.max(a, b))
        case 'empty':     return q.is(col, null)
        case 'not_empty': return q.not(col, 'is', null)
        default:          return q
      }
    }
    case 'date':
      switch (rule.op) {
        // created_at / archived_at are timestamps: "on" a day is the whole day.
        case 'on':        return col.endsWith('_at') ? q.gte(col, v).lt(col, nextDay(v)) : q.eq(col, v)
        case 'before':    return q.lt(col, v)
        case 'after':     return col.endsWith('_at') ? q.gte(col, nextDay(v)) : q.gt(col, v)
        case 'between': {
          const [lo, hi] = v <= v2 ? [v, v2] : [v2, v]
          return col.endsWith('_at') ? q.gte(col, lo).lt(col, nextDay(hi)) : q.gte(col, lo).lte(col, hi)
        }
        case 'empty':     return q.is(col, null)
        case 'not_empty': return q.not(col, 'is', null)
        default:          return q
      }
    case 'bool':
      return rule.op === 'is_true' ? q.eq(col, true) : q.or(`${col}.is.null,${col}.eq.false`)
    case 'aging': {
      const a = num(v), b = num(v2)
      if (a == null) return q
      if (rule.op === 'gt') return q.lt('date_executed', daysAgo(a))
      if (rule.op === 'lt') return q.gt('date_executed', daysAgo(a))
      if (rule.op === 'between' && b != null) {
        const lo = Math.min(a, b), hi = Math.max(a, b)
        return q.gte('date_executed', daysAgo(hi)).lte('date_executed', daysAgo(lo))
      }
      return q
    }
    default:
      return q
  }
}

function nextDay(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return localDateStr(new Date(y, (m || 1) - 1, (d || 1) + 1))
}

// ── Browser side (Pending Records) ───────────────────────────────────

const lower = v => String(v ?? '').toLowerCase()
const isBlank = v => v === null || v === undefined || String(v).trim() === ''
const dayOf = v => (isBlank(v) ? '' : String(v).slice(0, 10))

export function rowMatchesFilters(row, filters, { page = 'pending', missing = [], disabled = [] } = {}) {
  const f = normalizeFilters(filters)
  const skip = skipper(page, missing, disabled)

  const term = f.search.trim().toLowerCase()
  if (term) {
    const available = searchableFields(page).map(x => x.key).filter(k => !missing.includes(k))
    const cols = (f.searchIn.length ? f.searchIn : defaultSearchKeys(page)).filter(k => available.includes(k))
    if (!cols.some(c => lower(row[c]).includes(term))) return false
  }

  for (const [col, picked] of Object.entries(f.values)) {
    const field = FIELD_BY_KEY[col]
    if (skip(field)) continue
    const cell = row[col]
    const ok = picked.some(v => {
      if (v === BLANK) return isBlank(cell)
      if (field.type === 'number') return !isBlank(cell) && num(cell) === num(v)
      return lower(cell).trim() === lower(v).trim()
    })
    if (!ok) return false
  }

  for (const rule of f.rules) {
    if (!ruleIsComplete(rule)) continue
    const field = FIELD_BY_KEY[rule.field]
    if (skip(field)) continue
    if (!ruleMatches(row, field, rule)) return false
  }

  const range = periodRange(f.year, f.month)
  if (range) {
    const d = dayOf(row.date_executed)
    if (!d || d < range[0] || d > range[1]) return false
  }

  return true
}

function ruleMatches(row, field, rule) {
  const cell = row[field.key]
  const v = String(rule.value ?? '').trim()
  const v2 = String(rule.value2 ?? '').trim()

  switch (field.type) {
    case 'text': {
      const c = lower(cell), t = v.toLowerCase()
      switch (rule.op) {
        case 'contains':     return c.includes(t)
        case 'not_contains': return !c.includes(t)
        case 'is':           return c.trim() === t
        case 'is_not':       return c.trim() !== t
        case 'starts':       return c.startsWith(t)
        case 'empty':        return isBlank(cell)
        case 'not_empty':    return !isBlank(cell)
        default:             return true
      }
    }
    case 'number': {
      const n = isBlank(cell) ? null : num(cell)
      const a = num(v), b = num(v2)
      switch (rule.op) {
        case 'eq':        return n != null && n === a
        case 'gt':        return n != null && n > a
        case 'lt':        return n != null && n < a
        case 'between':   return n != null && n >= Math.min(a, b) && n <= Math.max(a, b)
        case 'empty':     return n == null
        case 'not_empty': return n != null
        default:          return true
      }
    }
    case 'date': {
      const d = dayOf(cell)
      switch (rule.op) {
        case 'on':        return d === v
        case 'before':    return !!d && d < v
        case 'after':     return !!d && d > v
        case 'between': {
          const [lo, hi] = v <= v2 ? [v, v2] : [v2, v]
          return !!d && d >= lo && d <= hi
        }
        case 'empty':     return !d
        case 'not_empty': return !!d
        default:          return true
      }
    }
    case 'bool':
      return rule.op === 'is_true' ? cell === true : cell !== true
    case 'aging': {
      const days = computeAgingDays(row.date_executed)
      const a = num(v), b = num(v2)
      if (days == null) return false
      if (rule.op === 'gt') return days > a
      if (rule.op === 'lt') return days < a
      if (rule.op === 'between') return days >= Math.min(a, b) && days <= Math.max(a, b)
      return true
    }
    default:
      return true
  }
}

// ── Plain-language summary (chips, saved filter list) ────────────────

export function describeRule(rule) {
  const field = FIELD_BY_KEY[rule.field]
  const spec = opSpec(rule.field, rule.op)
  if (!field || !spec) return ''
  if (spec.noValue) return `${field.label} ${spec.label}`
  if (spec.two) return `${field.label} ${spec.label} ${rule.value} and ${rule.value2}${field.type === 'aging' ? ' days' : ''}`
  return `${field.label} ${spec.label} ${rule.value}${field.type === 'aging' ? ' days' : ''}`
}

export function describeValues(col, picked) {
  const field = FIELD_BY_KEY[col]
  const shown = picked.map(v => (v === BLANK ? '(blank)' : v))
  const list = shown.length > 3 ? `${shown.slice(0, 3).join(', ')} +${shown.length - 3} more` : shown.join(', ')
  return `${field?.label || col}: ${list}`
}
