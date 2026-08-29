// Each sector owns its own tables (see sector_tables_setup.sql). Rizal keeps
// the original unsuffixed names because it already holds every historical
// record; the other sectors use a suffix.
//
// Every supabase.from(...) call for field orders or pending orders must go
// through these helpers — a hard-coded 'field_orders' silently reads and
// writes Rizal's data no matter which sector the user is in.

const SUFFIX = {
  rizal: '',
  manila: '_manila',
  pasig: '_pasig',
  balintawak: '_balintawak',
}

// Sectors that actually store records. MBDEVCO is excluded: it is a read-only
// rollup and owns no tables of its own.
export const DATA_SECTORS = ['rizal', 'manila', 'pasig', 'balintawak']

export const SECTOR_LABELS = {
  rizal: 'Rizal',
  manila: 'Manila',
  pasig: 'Pasig',
  balintawak: 'Balintawak',
  mbdevco: 'MBDEVCO',
}

export function isDataSector(sector) {
  return DATA_SECTORS.includes(sector)
}

// Falls back to Rizal's table for an unknown sector. Pages behind the layout
// guard always have a real sector, so this only covers a bad direct URL.
function suffixFor(sector) {
  return SUFFIX[sector] ?? ''
}

export function fieldOrdersTable(sector) {
  return `field_orders${suffixFor(sector)}`
}

export function pendingOrdersTable(sector) {
  return `pending_orders${suffixFor(sector)}`
}
