// The Status Crew badge, in one place.
//
// There were three copies of this — Field Orders, the Dashboard and the
// Super Admin's View Records — and all three carried the same bug: they
// tested for the status being exactly 'CANCEL', so CANCEL-EMC, FC CANCEL
// and REVISITED CANCEL all came out in the same grey as an ordinary
// pending status. A cancelled job is worth spotting however it was
// cancelled, so the test is now "says cancel anywhere".
//
// The text shown is the record's own, not the matched word, so CANCEL-EMC
// still reads CANCEL-EMC. Field completion is the one exception: several
// spellings of it exist in older data and they are all shown as
// FIELD COMPL. so the column does not look like it holds four different
// outcomes.

const CANCEL_TINT = 'bg-red-100 text-red-700'
const DONE_TINT = 'bg-emerald-100 text-emerald-700'
const OPEN_TINT = 'bg-slate-100 text-slate-600'

// Cancel is checked first. Nothing says both, so the order only matters
// if a status is ever added that does.
export default function StatusBadge({ status }) {
  const s = status?.toUpperCase() || ''
  const [tint, text] =
    s.includes('CANCEL') ? [CANCEL_TINT, status]
    : s.includes('FIELD') ? [DONE_TINT, 'FIELD COMPL.']
    : [OPEN_TINT, status || '—']

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tint}`}>{text}</span>
}
