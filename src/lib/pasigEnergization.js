// Energization, as Pasig records it.
//
// An energization connects a new service. Nothing is taken out, so most
// of what a replacement or a retirement records has nothing to describe:
// no meter came back, so there is nothing to batch and nothing to return,
// and with no meter sitting out there is nothing to age.
//
// The one exception is the seals. Some of these jobs are new
// applications, where there was never anything to unseal; others are
// recontracts, where the old seals are still on the service and are
// worth recording if they are intact. So the removed-seal fields stay
// available and are optional — the crew fills them in when there is
// something to fill in.
//
// Pasig only, for now. The other sectors hide the removed section
// outright on an energization, which is what they have always done.

import { baseFoAction } from './dropdownLists'

export function isPasigEnergization(sector, foAction) {
  return sector === 'pasig' && baseFoAction(foAction) === 'ENERGIZED FO'
}

// All that is kept of the removed section: the three seals that may
// still be on a recontracted service. Optional, every one of them.
export const ENERGIZATION_REMOVED_SEALS = [
  { key: 'removed_seal',         label: 'Terminal Seal' },
  { key: 'demand_seal_aerolock', label: 'Demand Seal' },
  { key: 'cabinet_seal_remove',  label: 'Cabinet Seal' },
]

// Dropped from the rest of the form. Nothing came out, so none of these
// has anything to describe.
export const ENERGIZATION_HIDDEN = ['mdltr_no', 'aging', 'for_batch', 'date_returned']

export function energizationHides(key, isEnergization) {
  return isEnergization && ENERGIZATION_HIDDEN.includes(key)
}
