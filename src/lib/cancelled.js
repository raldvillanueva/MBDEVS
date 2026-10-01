// A cancelled job never reached a meter, so none of the meter fields apply
// to it: no meter was removed, none was installed, nothing was returned.
// What is left worth recording is the main details, what it was billed at,
// and a note saying why.
//
// Either field can carry the cancellation — the crew's status or the job
// description — so both are checked.

const CANCELLED = ['CANCEL', 'CANCEL-EMC']

export function isCancelledRecord(row) {
  return (
    CANCELLED.includes((row?.status_crew || '').toUpperCase()) ||
    CANCELLED.includes((row?.job_description || '').toUpperCase())
  )
}
