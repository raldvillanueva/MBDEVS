import { createContext, useContext, useState, useCallback } from 'react'

const SectorContext = createContext(undefined)
const STORAGE_KEY = 'selectedSector'

export function SectorProvider({ children }) {
  const [sector, setSectorState] = useState(() => sessionStorage.getItem(STORAGE_KEY) || null)

  const setSector = useCallback((value) => {
    sessionStorage.setItem(STORAGE_KEY, value)
    setSectorState(value)
  }, [])

  const clearSector = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSectorState(null)
  }, [])

  return (
    <SectorContext.Provider value={{ sector, setSector, clearSector }}>
      {children}
    </SectorContext.Provider>
  )
}

export function useSector() {
  const ctx = useContext(SectorContext)
  if (ctx === undefined) throw new Error('useSector must be used within SectorProvider')
  return ctx
}
