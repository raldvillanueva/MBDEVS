// Fields one sector records and the others do not.
//
// Pasig logs two further sets of seals on a newly installed meter — LCG
// and MCB — which nobody else is asked for. Rather than put the columns
// on all five sectors and leave them empty on four, they live only on
// Pasig's tables (pasig_seal_fields_setup.sql) and the app shows them
// only there.
//
// Everything that saves a record has to strip the keys that do not
// belong to the sector it is saving into, or a Manila record carries a
// column Manila's table has never heard of and the whole insert fails.
// withSectorFields does that in one place.

export const SECTOR_EXTRA_FIELDS = {
  pasig: [
    {
      key: 'lcg_others',
      label: 'LCG (Others)',
      // Several seals go in each, written as the crew recorded them.
      placeholder: 'Seals used — usually 5 to 10',
      section: 'installed',
    },
    {
      key: 'mcb_others',
      label: 'MCB (Others)',
      placeholder: 'Seals used — usually 2 to 4',
      section: 'installed',
    },
  ],
}

/** The extra fields this sector asks for, in the order they are shown. */
export function extraFields(sector) {
  return SECTOR_EXTRA_FIELDS[sector] || []
}

export function extraFieldKeys(sector) {
  return extraFields(sector).map(f => f.key)
}

/** Every extra-field key any sector defines, for stripping. */
export const ALL_EXTRA_FIELD_KEYS = [
  ...new Set(Object.values(SECTOR_EXTRA_FIELDS).flat().map(f => f.key)),
]

/**
 * Drop the extra fields that do not belong in this save.
 *
 * `has` is whether the sector's tables actually have the columns yet.
 * False leaves them out too, so the app keeps working before the
 * migration has been run rather than failing every save until it is —
 * the same arrangement the submission columns use.
 */
export function withSectorFields(payload, sector, has) {
  const keep = has ? new Set(extraFieldKeys(sector)) : new Set()
  const out = { ...payload }
  for (const key of ALL_EXTRA_FIELD_KEYS) {
    if (!keep.has(key)) delete out[key]
  }
  return out
}
