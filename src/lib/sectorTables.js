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
  ami: '_ami',
}

// Sectors that actually store records. MBDEVCO is excluded: it is a read-only
// rollup and owns no tables of its own.
export const DATA_SECTORS = ['rizal', 'manila', 'pasig', 'balintawak', 'ami']

export const SECTOR_LABELS = {
  rizal: 'Rizal',
  manila: 'Manila',
  pasig: 'Pasig',
  balintawak: 'Balintawak',
  ami: 'AMI',
  mbdevco: 'MBDEVCO',
}

export function isDataSector(sector) {
  return DATA_SECTORS.includes(sector)
}

/**
 * Which sectors an account may use.
 *
 * No list at all means unrestricted, so a profile that predates the
 * restriction — or one nobody has limited — keeps every sector. An empty
 * list is read the same way rather than as "allowed into nothing", which
 * would lock someone out through a blank field rather than a decision.
 */
export function allowedSectors(profile) {
  const listed = profile?.sectors
  if (!Array.isArray(listed) || listed.length === 0) return DATA_SECTORS
  return DATA_SECTORS.filter(s => listed.includes(s))
}

export function isSectorRestricted(profile) {
  return Array.isArray(profile?.sectors) && profile.sectors.length > 0
}

export function canUseSector(profile, sector) {
  if (!isSectorRestricted(profile)) return true
  return profile.sectors.includes(sector)
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
