import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { setOverdueThreshold } from './aging'

// What the app used before these values were editable. They stay here as the
// fallback so a missing app_settings table — or a failed fetch — degrades to
// the old behaviour instead of an empty crew dropdown and zero overdue counts.
export const SETTINGS_DEFAULTS = {
  crewNames: ['A. TOMADA', 'B. VERDARERO', 'C. BENIGNO', 'D. FABOL', 'E. VILLAREAL', 'J. BITAGO', 'J. J. SERRANO'],
  warningDays: 10,
  criticalDays: 21,
}

const SettingsContext = createContext({ ...SETTINGS_DEFAULTS, loading: true, reload: () => {} })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('key, value')

    if (error) {
      // Not fatal: every consumer works off the defaults above.
      console.error('Could not load system settings — using defaults', error)
      setLoading(false)
      return
    }

    const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]))
    const next = {
      crewNames: Array.isArray(byKey.crew_names) && byKey.crew_names.length
        ? byKey.crew_names
        : SETTINGS_DEFAULTS.crewNames,
      warningDays: Number(byKey.overdue_warning_days) || SETTINGS_DEFAULTS.warningDays,
      criticalDays: Number(byKey.overdue_critical_days) || SETTINGS_DEFAULTS.criticalDays,
    }

    // The red "overdue" styling in the Field Orders table is decided outside
    // React, so the threshold has to be handed to aging.js directly.
    setOverdueThreshold(next.criticalDays)

    setSettings(next)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const value = useMemo(() => ({ ...settings, loading, reload }), [settings, loading, reload])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
