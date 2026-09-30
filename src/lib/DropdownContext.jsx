import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { DEFAULT_OPTIONS, DROPDOWN_FIELD_KEYS, normalizeOption } from './dropdownLists'

// One copy of the editable dropdown lists for the whole app, so the Add
// form, both edit drawers, the filters and the importer always offer the
// same choices.
//
// If dropdown_options cannot be read (the SQL has not been run yet, or the
// network failed) every list falls back to DEFAULT_OPTIONS — the values
// the app offered before — rather than an empty dropdown.

const DropdownContext = createContext(null)

export function DropdownProvider({ children }) {
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('dropdown_options')
      .select('*')
      .order('field')
      .order('sort_order')
      .order('value')

    if (error) {
      console.error('Could not load dropdown lists — using the built-in defaults', error)
      setTableMissing(true)
      setRows([])
    } else {
      setTableMissing(false)
      setRows(data || [])
    }
    setLoading(false)
  }, [])

  // Signed out, RLS returns nothing; reload once there is a session.
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    reload()
  }, [userId, reload])

  const value = useMemo(() => {
    const byField = Object.fromEntries(DROPDOWN_FIELD_KEYS.map(k => [k, []]))
    for (const row of rows) byField[row.field]?.push(row)
    const usingDefaults = tableMissing || rows.length === 0

    /**
     * The choices to offer for one field in one sector.
     *
     * current: the value already on the record being edited. If it is no
     * longer on the list (hidden, renamed, or never was), it is still
     * offered — otherwise opening an old record would show a blank select
     * and saving could lose the value.
     */
    function optionsFor(field, sector, current) {
      let list
      if (usingDefaults) {
        list = [...(DEFAULT_OPTIONS[field] || [])]
      } else {
        list = (byField[field] || [])
          .filter(r => r.active && (!r.sectors || r.sectors.length === 0 || !sector || r.sectors.includes(sector)))
          .map(r => r.value)
      }
      const cur = current == null ? '' : String(current)
      if (cur && !list.some(v => normalizeOption(v) === normalizeOption(cur))) list.push(cur)
      return list
    }

    return { rows, byField, loading, tableMissing, usingDefaults, optionsFor, reload }
  }, [rows, loading, tableMissing, reload])

  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>
}

export function useDropdowns() {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error('useDropdowns must be used within DropdownProvider')
  return ctx
}
