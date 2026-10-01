// The dropdowns an Admin / Super Admin can edit from the Dropdown Lists
// page. The values live in the dropdown_options table
// (dropdown_lists_and_filters_setup.sql); DEFAULT_OPTIONS below is only
// the fallback used when that table cannot be read — for example before
// the SQL has been run — so every form keeps working either way.

export const DROPDOWN_FIELDS = [
  { key: 'job_description', label: 'Job Description' },
  { key: 'type_of_meter',   label: 'Type of Meter' },
  { key: 'fo_type',         label: 'FO Type' },
  { key: 'for_batch',       label: 'For Batch' },
  { key: 'billed_amount',   label: 'FO Amount', numeric: true },
  // Suggestions only: the form still accepts any name typed in.
  { key: 'submitted_to',    label: 'Submitted To', freeText: true },
  // Moved here from the General tab. Crews are per sector in practice,
  // and this is the only list that can be limited to one.
  { key: 'crew_name',       label: 'Crew Name' },
]

export const DROPDOWN_FIELD_KEYS = DROPDOWN_FIELDS.map(f => f.key)

export function dropdownFieldLabel(key) {
  return DROPDOWN_FIELDS.find(f => f.key === key)?.label || key
}

// Everything any form, drawer or filter offered before the lists became
// editable, merged — nothing that used to be selectable was dropped.
export const DEFAULT_OPTIONS = {
  job_description: [
    'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX', 'RETIRE', 'RETIRE-EMC', 'RETIRE-EMC-WIRE', 'REMOVE',
    'BROKEN-SEAL', 'RE-SEALING OF LSG & GRILLS', 'DISCONNECTION', 'RECONNECTION',
    'EMPTY METER BASE', 'MULTI METERING', 'ENERGIZATION', 'REPREL', 'ERC SAMPLING', 'AMI',
    'ASSIST TO REGULAR CREW', 'BASKET-ENERGIZE', 'INTERCHANGE', 'MC/PU -REPLACE',
    'MC/PU -ENERGIZE', 'MC/PU -RETIRE', 'RETAIN METER', 'ROLAND',
  ],
  type_of_meter: [
    '12S', '12S ID METER', '1S', '1S EMC L-G', '25S', '2S EMC L-G', '2S EMC L-L', '2S EMX', '2S ID',
    '2S ID METER', '2S ID METER/ERC', '2S PLAIN METER', '9S', 'EMX', 'ERC 2S PLAIN METER',
    'FOR REPLACE', 'KLOAD', 'RETURNED', '1S PLAIN METER', '3S PLAIN METER',
  ],
  fo_type: [
    'CANCEL', 'CANCEL-EMC', 'CUT SERVICE ENTRANCE', 'ENERGIZED', 'REMOVE', 'REMOVE-EMC',
    'REMOVE-EMC-WIRE', 'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX', 'RETIRE',
  ],
  for_batch: ['ALREADY BATCH', 'FOR BATCH', 'MISSING METER', 'OTHERS PENDING'],
  billed_amount: ['0', '172.45', '253.43', '344.9', '383.22', '574.83', '766.44', '958.05', '1013.71', '1689.61'],
  submitted_to: [],
  // Only the fallback for before the migration has run. The real names
  // come from dropdown_options.
  crew_name: [],
}

// Status Crew and FO Action stay fixed on purpose: the app reads them to
// decide things (a crew name flips the status to ASSIGNED, FO Action picks
// which form sections show), so renaming one would quietly break that.
// They are still filterable like any other column.
export const STATUS_CREW_OPTIONS = [
  'FOR ASSIGN', 'ASSIGNED', 'RE-ASSIGN', 'FIELD COMPL.', 'CANCEL', 'CANCEL-EMC', 'FC CANCEL',
  'REVISITED FIELD COM.', 'REVISITED CANCEL',
]

export const FO_ACTION_OPTIONS = [
  'Replace FO',
  'Energized FO',
  'Retirement FO',
  'Rep/rel FO',
  'Replace Standard FO',
  'Reconnection FO',
  'Reconnect Damaged FO',
  'Disconnection FO',
  // Last on purpose: the Dashboard counts anything it does not
  // recognise under Others, so this is where the leftovers land.
  'Others',
]

/** Same comparison the database unique index uses. */
export function normalizeOption(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}
