import { useCallback, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { useDropdowns } from './DropdownContext'
import { useSettings } from './SettingsContext'
import { DROPDOWN_FIELD_KEYS, FO_ACTION_OPTIONS, STATUS_CREW_OPTIONS, normalizeOption } from './dropdownLists'
import { BLANK, filterField } from './recordFilters'

// Spellings other screens have used for Status Crew. Offered in the filter
// so records saved with either can still be found.
const STATUS_FILTER_OPTIONS = [...STATUS_CREW_OPTIONS, 'REASSIGN', 'FIELD COMPLETED']

const CACHE_MS = 60 * 1000

/**
 * The values to offer when filtering a column: the dropdown list PLUS
 * whatever is actually in the records (with how many records have it).
 * Values in the records but not on the list are marked, so an old or
 * imported spelling can still be found — and spotted.
 *
 *   rows given     count from those rows (Pending: all rows are loaded)
 *   rows omitted   ask the database (Field Orders / Archived), via
 *                  field_order_distinct_values. If that function is not
 *                  installed yet, only the list is offered.
 */
export function useColumnOptions({ page, sector, rows }) {
  const { optionsFor } = useDropdowns()
  const { crewNames } = useSettings()
  const cache = useRef(new Map())

  useEffect(() => { cache.current = new Map() }, [page, sector])

  return useCallback(async (fieldKey) => {
    const field = filterField(fieldKey)
    if (!field) return []
    const numeric = field.type === 'number'

    let listValues = []
    if (DROPDOWN_FIELD_KEYS.includes(fieldKey)) listValues = optionsFor(fieldKey, sector)
    else if (fieldKey === 'crew_name') listValues = crewNames || []
    else if (fieldKey === 'status_crew') listValues = STATUS_FILTER_OPTIONS
    else if (fieldKey === 'fo_action') listValues = FO_ACTION_OPTIONS

    let data = null
    if (rows) {
      const counts = new Map()
      for (const r of rows) {
        const v = r[fieldKey]
        const key = v === null || v === undefined || String(v).trim() === '' ? BLANK : String(v)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
      data = [...counts].map(([value, n]) => ({ value, n }))
    } else {
      const cacheKey = `${sector}:${page}:${fieldKey}`
      const hit = cache.current.get(cacheKey)
      if (hit && Date.now() - hit.at < CACHE_MS) {
        data = hit.data
      } else {
        const { data: res, error } = await supabase.rpc('field_order_distinct_values', {
          p_sector: sector, p_column: fieldKey, p_archived: page === 'archived',
        })
        if (!error && Array.isArray(res)) {
          data = res.map(r => ({ value: r.value == null || String(r.value).trim() === '' ? BLANK : r.value, n: Number(r.n) || 0 }))
          cache.current.set(cacheKey, { at: Date.now(), data })
        }
      }
    }

    const keyOf = v => {
      if (v === BLANK) return BLANK
      if (numeric) {
        const n = parseFloat(v)
        return Number.isFinite(n) ? String(n) : normalizeOption(v)
      }
      return normalizeOption(v)
    }

    const merged = new Map()
    for (const v of listValues) {
      const k = keyOf(v)
      if (!merged.has(k)) merged.set(k, { value: String(v), label: String(v), count: data ? 0 : null, onList: true })
    }
    const extras = []
    for (const { value, n } of data || []) {
      const k = keyOf(value)
      const hit = merged.get(k)
      if (hit) {
        hit.count = (hit.count || 0) + n
      } else {
        const item = { value: String(value), label: String(value), count: n, onList: false }
        merged.set(k, item)
        extras.push(item)
      }
    }
    // A blank bucket is handled by the picker itself; keep its count.
    const blank = merged.get(BLANK)

    const managed = DROPDOWN_FIELD_KEYS.includes(fieldKey)
    const ordered = [
      ...[...merged.values()].filter(o => o.onList),
      ...extras.filter(o => o.value !== BLANK).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    ].map(o => ({ value: o.value, label: o.label, count: o.count, notOnList: managed && !o.onList }))

    if (blank) ordered.push({ value: BLANK, label: '(Blank)', count: blank.count })
    return ordered
  }, [optionsFor, crewNames, rows, page, sector])
}
