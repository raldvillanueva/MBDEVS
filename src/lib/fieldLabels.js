// Human labels for field_orders columns, keyed the same as EMPTY_FORM in
// FieldOrders.jsx / RecordForm.jsx. Used wherever a raw field name would
// otherwise be shown to someone reviewing a change — right now that's
// the Edit Requests diff.
export const FIELD_LABELS = {
  status_crew: 'Status Crew',
  date_assign: 'Date Assign',
  for_check: 'For Check',
  date_executed: 'For Checking (Date)',
  type_of_meter: 'Type of Meter',
  job_description: 'Job Description',
  crew_name: 'Crew Name',
  location: 'Location',
  service_number: 'Service ID Number',
  field_order_no: 'Field Order/FO',
  remove_meter: 'Remove Meter',
  r_serial_number: 'R. Serial Number',
  demand_seal_aerolock: 'Demand Seal No.5',
  removed_seal: 'Removed Seal',
  cabinet_seal_remove: 'Cabinet Seal (2)',
  reading_kwh: 'Reading (kWh)',
  demand_kwh_cum: 'DEMAND (kWh)/Cum Demand',
  ins_meter: 'INS. Meter',
  ins_serial_number: 'Serial Number',
  demand_seal_installed: 'Demand Seal (5)',
  installed_seal: 'Installed Seal (1)',
  cabinet_seal_installed: 'Cabinet Seal (2)',
  tln_tag: 'TLN Tag',
  pole_tag: 'Pole Tag',
  booba_number: 'Booba Number',
  mdltr_no: 'MDLTR No.',
  aging: 'Aging',
  witness_date: 'Witness Date',
  remarks: 'Remarks',
  mflt_checklist: 'MFLT Checklist',
  fo_type: 'FO Type',
  billed_amount: 'Billed Amount',
  for_batch: 'For Batch',
  date_returned: 'Date Returned',
  crew_payrol: 'Crew Payroll',
  percentage: '%',
  pluscode: 'Pluscode',
}

export function labelFor(field) {
  return FIELD_LABELS[field] || field
}

// A blank/false/empty value reads better as an em dash than as "" or
// "false" in a before/after diff.
export function displayValue(value) {
  if (value === true) return 'Checked'
  if (value === false || value === null || value === undefined || value === '') return '—'
  return String(value)
}
