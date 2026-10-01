import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useSettings } from './SettingsContext'
import { fieldOrdersTable, pendingOrdersTable, isDataSector } from './sectorTables'

// Submitted To / Date of Submitted are new columns. They only exist once
// dropdown_lists_and_filters_setup.sql has been run in Supabase, so the app
// checks first: until then the two fields stay hidden and are left out of
// every save, instead of every save failing with "column does not exist".
// This lets the code go live before the database has been updated.

export const SUBMISSION_COLUMNS = ['submitted_to', 'date_submitted']

// Keyed on the table *and* the columns asked about: more than one set of
// new columns is checked now, and keying on the table alone would hand
// back the answer to a different question.
const cache = new Map() // 'table:col,col' -> Promise<boolean>

function tableHas(table, columns) {
  const key = `${table}:${columns.join(',')}`
  if (!cache.has(key)) {
    cache.set(key, supabase.from(table).select(columns.join(',')).limit(1)
      .then(({ error }) => !error)
      .catch(() => false))
  }
  return cache.get(key)
}

/** true once both of the sector's tables have the submission columns. */
export function useSubmissionColumns(sector) {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let alive = true
    if (!isDataSector(sector)) { setHas(false); return undefined }
    Promise.all([
      tableHas(fieldOrdersTable(sector), SUBMISSION_COLUMNS),
      tableHas(pendingOrdersTable(sector), SUBMISSION_COLUMNS),
    ]).then(([a, b]) => { if (alive) setHas(a && b) })
    return () => { alive = false }
  }, [sector])
  return has
}

/** Drop the submission fields from a save when the table cannot take them. */
export function withSubmission(payload, has) {
  if (has) {
    // An empty date input is '' — the date column needs null.
    return 'date_submitted' in payload ? { ...payload, date_submitted: payload.date_submitted || null } : payload
  }
  const out = { ...payload }
  for (const c of SUBMISSION_COLUMNS) delete out[c]
  return out
}

// Photos arrived the same way, with record_photos_setup.sql. Until that
// has been run the strip stays hidden and `photos` is left out of saves,
// so the app works either side of the migration.

export const PHOTO_COLUMNS = ['photos']

/** true once both of the sector's tables can hold photo paths. */
export function usePhotoColumn(sector) {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let alive = true
    if (!isDataSector(sector)) { setHas(false); return undefined }
    Promise.all([
      tableHas(fieldOrdersTable(sector), PHOTO_COLUMNS),
      tableHas(pendingOrdersTable(sector), PHOTO_COLUMNS),
    ]).then(([a, b]) => { if (alive) setHas(a && b) })
    return () => { alive = false }
  }, [sector])
  return has
}

/** Drop the photo list from a save when the table cannot take it. */
export function withPhotos(payload, has) {
  if (has) return payload
  const out = { ...payload }
  for (const c of PHOTO_COLUMNS) delete out[c]
  return out
}

/**
 * For the filter bar and column headers of one sector:
 *   missing   new columns this sector's tables do not have yet
 *   disabled  columns the Super Admin switched filtering off for
 *   hidden    both together (no filter offered)
 */
export function useFilterColumns(sector) {
  const hasSubmission = useSubmissionColumns(sector)
  const { disabledFilterColumns } = useSettings()
  return useMemo(() => {
    const missing = hasSubmission ? [] : SUBMISSION_COLUMNS
    const disabled = disabledFilterColumns || []
    return { hasSubmission, missing, disabled, hidden: [...new Set([...missing, ...disabled])] }
  }, [hasSubmission, disabledFilterColumns])
}
