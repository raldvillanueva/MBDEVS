import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSector } from '../lib/SectorContext'
import { fieldOrdersTable, pendingOrdersTable } from '../lib/sectorTables'
import { Save, X } from 'lucide-react'
import { addPendingOrders } from '../lib/pendingStorage'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useSettings } from '../lib/SettingsContext'
import { isCancelledRecord } from '../lib/cancelled'
import { FO_ACTION_OPTIONS } from '../lib/dropdownLists'
import { useDropdowns } from '../lib/DropdownContext'
import { useSubmissionColumns, usePhotoColumn, withPhotos, withSubmission } from '../lib/optionalColumns'
import RecordPhotos from './RecordPhotos'
 
const EMPTY_FORM = {
  // Main Info
  status_crew: 'FOR ASSIGN',
  date_assign: '',
  for_check: false,
  date_executed: '',
  type_of_meter: '',
  job_description: '',
  crew_name: '',
  location: '',
  service_number: '',
  field_order_no: '',
  fo_action: '',
  // Remove Meter
  remove_meter: '',
  r_serial_number: '',
  demand_seal_aerolock: '',
  removed_seal: '',
  cabinet_seal_remove: '',
  reading_kwh: '',
  // New Installed Meter
  ins_meter: '',
  ins_serial_number: '',
  demand_seal_installed: '',
  installed_seal: '',
  cabinet_seal_installed: '',
  tln_tag: '',
  pole_tag: '',
  booba_number: '',
  mdltr_no: '',
  aging: '',
  witness_date: '',
  // Remarks & Batch
  remarks: '',
  mflt_checklist: false,
  fo_type: '',
  billed_amount: '',
  for_batch: '',
  date_returned: '',
  crew_payrol: '',
  percentage: '',
  pluscode: '',
  plangrid: '',
  // Main Info, new — only shown/saved once the database has the columns
  submitted_to: '',
  date_submitted: '',
  photos: [],
}

function Field({ label, children, required, errorMessage }) {
  return (
    <div className="flex flex-col gap-1">

      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
        {label}
        {required && (
          <span className="text-red-500 ml-0.5">*</span>
        )}
      </label>

      {children}

      {errorMessage && (
        <span className="text-xs text-red-600 mt-1">
          {errorMessage}
        </span>
      )}

    </div>
  )
}

const inputClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full"
const selectClass = `${inputClass}`

function SectionTitle({ title }) {
  return (
    <div className="col-span-full mt-2">
      <h3 className="text-sm font-semibold text-slate-700 pb-2 border-b border-slate-200">{title}</h3>
    </div>
  )
}

export default function RecordForm({ initialData, recordId, repeatCount }) {
  const { sector } = useSector()
  const foTable = fieldOrdersTable(sector)
  const poTable = pendingOrdersTable(sector)
  const { accountType, canEncode, canManage } = useAuth()
  // Job Description, Type of Meter, FO Type, For Batch, Billed Amount and
  // Crew Name come from the Dropdown Lists page. The record's own value is
  // always offered too, so an older value is never blanked out on edit.
  const { optionsFor } = useDropdowns()
  const opts = field => optionsFor(field, sector, form[field])
  const hasSubmission = useSubmissionColumns(sector)
  const hasPhotos = usePhotoColumn(sector)
  // A Viewer has no business on this form at all. An Encoder does: they
  // add to Pending, and a reviewer moves it on to Field Orders.
  const isStaff = accountType === 'viewer' || !canEncode
  const fastFONoRef = useRef(null)
  const autoSubmitLock = useRef(false)
  const [form, setForm] = useState(initialData || EMPTY_FORM)
  // Below `form`, not above it: opts() reads form[field], so calling it any
  // earlier reads a const that has not been initialised yet and throws
  // before the form can render at all.
  const crewNames = opts('crew_name')
  const [saving, setSaving] = useState(false)
  const [savingPending, setSavingPending] = useState(false)
  const [pendingRepeat, setPendingRepeat] = useState(1)
  const [saveRepeat, setSaveRepeat] = useState(1)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
const [pendingMode, setPendingMode] = useState("queue") // "queue" | "stack"
const [pendingItems, setPendingItems] = useState(() => {
  return JSON.parse(localStorage.getItem("pendingOrders") || "[]")
})
const [selectedPending, setSelectedPending] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

const currentRepeat =
location.state?.currentRepeat || 1

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

function text(field) {

  return {

    value: form[field] ?? '',

    onChange: e => {

      set(field,e.target.value)

      setFieldErrors(prev=>({
        ...prev,
        [field]:false
      }))

    },


    className: `
      ${inputClass}

      ${
        fieldErrors[field]
        ? '!border-red-500 !bg-red-200'
        : ''
      }

    `

  }

}


async function saveRecord(payload, recordId) {
  if (recordId) {
    return await supabase
      .from(foTable)
      .update(payload)
      .eq('id', recordId)
  }

  return await supabase
    .from(foTable)
    .insert([payload])
}


async function handleSubmit(e, mode = "supabase", { auto = false } = {}) {
  e.preventDefault()
  setError('')
  const isPending = mode === "pending"
  isPending ? setSavingPending(true) : setSaving(true)

  // =========================
  // REQUIRED FIELDS
  // =========================
  const requiredFields = isPending
    ? {
        field_order_no: "Field Order no.",
      }
    : {
        field_order_no: "Field Order no.",
        ...(showInstalledMeterFields ? { ins_meter: "Installed Meter no." } : {}),
        // An MFLT removal is not complete without these two.
        ...(form.mflt_checklist ? {
          booba_number: "Booba Number",
          witness_date: "Witnessing Date",
        } : {}),
      }

  const errors = {}

  Object.keys(requiredFields).forEach(field => {
    if (!form[field]) {
      errors[field] = "This field cannot be blank"
    }
  })

  const stopLoading = () => isPending ? setSavingPending(false) : setSaving(false)

  if (Object.keys(errors).length > 0) {
    setFieldErrors(errors)
    stopLoading()
    return
  }

  // =========================
  // DUPLICATE CHECKS
  // =========================
  const { data: existingFO } = await supabase
    .from(foTable)
    .select('id')
    .eq('field_order_no', form.field_order_no)
    .maybeSingle()

  if (existingFO && existingFO.id !== recordId) {
    setFieldErrors({ field_order_no: "This Field Order number already exists" })
    stopLoading()
    return
  }

  let existingMeter = null
  if (form.ins_meter) {
    const { data } = await supabase
      .from(foTable)
      .select('id')
      .eq('ins_meter', form.ins_meter)
      .maybeSingle()
    existingMeter = data
  }

  if (existingMeter && existingMeter.id !== recordId) {
    setFieldErrors({ ins_meter: "This Installed Meter number already exists" })
    stopLoading()
    return
  }

  // =========================
  // PAYLOAD
  // =========================
  const payload = withPhotos(withSubmission({
    ...form,
    aging: form.aging ? parseInt(form.aging) : null,
    billed_amount: form.billed_amount ? parseFloat(form.billed_amount) : null,
    crew_payrol: form.crew_payrol ? parseFloat(form.crew_payrol) : null,
    date_assign: form.date_assign || null,
    date_executed: form.date_executed || null,
    witness_date: form.witness_date || null,
    date_returned: form.date_returned || null,
  }, hasSubmission), hasPhotos)

  let error = null

  // =========================
  // IMPORTANT FIX: RESET FLOW CONTROL
  // =========================
  let success = false

  // =========================
  // SAVE LOGIC (SAME FLOW, CLEANED)
  // =========================

if (!isPending) {
  let result

  if (recordId) {
    result = await supabase
      .from(foTable)
      .update(payload)
      .eq('id', recordId)
  } else {
    result = await supabase
      .from(foTable)
      .insert([payload])
  }

  error = result.error

  if (!error) {
    success = true
  }
}
  if (isPending) {
    const { data: existingPending } = await supabase
      .from(poTable)
      .select('field_order_no, ins_meter')

    const dupes = existingPending || []

    if (dupes.some(item => item.field_order_no === form.field_order_no)) {
      setFieldErrors({ field_order_no: "This Field Order number already exists in Pending" })
      setSavingPending(false)
      return
    }

    if (form.ins_meter && dupes.some(item => item.ins_meter === form.ins_meter)) {
      setFieldErrors({ ins_meter: "This Installed Meter number already exists in Pending" })
      setSavingPending(false)
      return
    }

    const { error: pendingError } = await supabase
      .from(poTable)
      .insert([payload])

    if (pendingError) {
      setError(pendingError.message)
      setSavingPending(false)
      return
    }

    setFieldErrors({})
    setSavingPending(false)
    if (!auto && pendingRepeat >= repeatCount) {
      navigate('/field-orders')
    } else {
      setForm(EMPTY_FORM)
      setPendingRepeat(prev => prev + 1)
    }
    return
  }

  // =========================
  // STOP IF ERROR
  // =========================
  if (error) {
    setError(error.message)
    setSaving(false)
    return
  }

  // =========================
  // ONLY RUN REPETITION IF SAVE SUCCESSFUL
  // (THIS FIXES YOUR BUG)
  // =========================
  if (!success) {
    setSaving(false)
    return
  }

if (saveRepeat >= repeatCount) {
  navigate(
    form.archived_at
      ? '/archived-work-orders'
      : '/field-orders'
  )
} else {
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setSaveRepeat(prev => prev + 1)
  }

  setSaving(false)
}
async function submitFastEncoding() {
  if (autoSubmitLock.current) return
  autoSubmitLock.current = true
  await handleSubmit({ preventDefault: () => {} }, 'pending', { auto: true })
  autoSubmitLock.current = false
  fastFONoRef.current?.focus()
}

function handleFastEncodingKeyDown(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  if (!form.field_order_no) return
  submitFastEncoding()
}

function deletePendingRecord(id) {

  const existingPending =
    JSON.parse(localStorage.getItem("pendingOrders") || "[]")


  const updated = existingPending.filter(
    item => item.id !== id
  )


  localStorage.setItem(
    "pendingOrders",
    JSON.stringify(updated)
  )


  setPendingItems(updated)

}

  // Which sections show below Main Information, based on the chosen FO Action:
  //   Replace FO     -> everything
  //   Energized FO   -> New Installed Meter + Remarks & Batch (no Remove Meter)
  //   Retirement FO  -> Remove Meter + Remarks & Batch, and of the New Installed
  //                     Meter fields only the installed Terminal Seal
  //   Others / none  -> everything (safe default)
  const isRetirementFO = form.fo_action === 'Retirement FO'
  // A cancelled job never reached a meter, so neither meter section applies
  // and Remarks keeps only the amount and the note explaining it.
  const isCancelled = isCancelledRecord(form)
  const showRemoveMeterSection = form.fo_action !== 'Energized FO' && !isCancelled
  const showInstalledMeterFields = !isRetirementFO && !isCancelled

  return (
    
    <form onSubmit={(e) => handleSubmit(e, recordId ? "supabase" : "pending")}>
      
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

<h3 className="text-sm font-semibold text-slate-700 mb-4">
FAST ENCODING
</h3>


<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">


<Field
label="Field Order No."
required
errorMessage={fieldErrors.field_order_no}
>

<input
{...text('field_order_no')}
ref={fastFONoRef}
onKeyDown={handleFastEncodingKeyDown}
placeholder="Scan Field Order"
/>

</Field>



<Field
label="FO Action"
>

<select
{...text('fo_action')}
>
  <option value="">— Select —</option>
  {FO_ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
</select>

</Field>
</div>

</div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!isStaff && (
      <>
      {/* Section 1 – Main Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle title="Main Information" />

          <Field label="Field Order No." required errorMessage={fieldErrors.field_order_no}>
            <input {...text('field_order_no')} placeholder="e.g. F25090604378" />
          </Field>

          <Field label="Service ID Number">
            <input {...text('service_number')} placeholder="e.g. 43890272-01" />
          </Field>

          <Field label="Status Crew" >
<select {...text('status_crew')}>
              <option value="">— Select —</option>
              <option value="FOR ASSIGN">FOR ASSIGN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="RE-ASSIGN">RE-ASSIGN</option>
              <option value="FIELD COMPL.">FIELD COMPL.</option>
              <option value="CANCEL">CANCEL</option>
              <option value="CANCEL-EMC">CANCEL-EMC</option>
              <option value="FC CANCEL">FC CANCEL</option>
              <option value="REVISITED FIELD COM.">REVISITED FIELD COM.</option>
              <option value="REVISITED CANCEL">REVISITED CANCEL</option>
            </select>
          </Field>

          <Field label="Date Assign">
            <input type="date" {...text('date_assign')} />
          </Field>

          <Field label="Date Executed" >
            <input type="date" {...text('date_executed')} />
          </Field>

          <Field label="For Check">
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="for_check"
                checked={!!form.for_check}
                onChange={e => set('for_check', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="for_check" className="text-sm text-slate-600">Checked</label>
            </div>
          </Field>


          {/* No meter was touched on a cancelled job, so there is no type
              to record. */}
          {!isCancelled && (
          <Field label="Type of Meter">
            <select {...text('type_of_meter')} className={selectClass}>
              <option value="">— Select —</option>
              {opts('type_of_meter').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          )}

          <Field label="Job Description">
            <select {...text('job_description')} className={selectClass}>
              <option value="">— Select —</option>
              {opts('job_description').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Crew Name" required errorMessage={fieldErrors.crew_name}>
            {/* A select like every other list on this form. It was a
                datalist so a one-off name could be typed, but that renders
                as a differently-styled native popup and stood out against
                the rest — and crews are managed in Settings now, so adding
                one is no longer a code change. */}
            <select
              value={form.crew_name ?? ''}
              onChange={e => {
                const crew = e.target.value
                setFieldErrors(prev => ({ ...prev, crew_name: false }))
                setForm(prev => ({
                  ...prev,
                  crew_name: crew,
                  // Assigning a crew is what moves a job off the unassigned
                  // pile, and clearing it puts the job back.
                  status_crew: crew.trim() === '' ? 'FOR ASSIGN' : 'ASSIGNED',
                }))
              }}
              className={`${selectClass} ${fieldErrors.crew_name ? '!border-red-500 !bg-red-200' : ''}`}
            >
              <option value="">— Select —</option>
              {/* A record can hold a crew who has since been taken off the
                  list. Without this the select would show blank and quietly
                  reassign them on the next save. */}
              {form.crew_name && !crewNames.includes(form.crew_name) && (
                <option value={form.crew_name}>{form.crew_name}</option>
              )}
              {crewNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            {/* The list can now genuinely be empty, and this is a required
                field — so say where the names come from rather than leaving
                a dropdown with nothing in it. */}
            {crewNames.length === 0 && (
              <span className="text-xs text-amber-600">
                No crews set up yet — add them in System Settings → Dropdown Lists.
              </span>
            )}
          </Field>

          <Field label="Location" >
            <div className="col-span-full">
              <input 
  {...text('location')} 
  placeholder="e.g. 0242 SUMULONG, STA CRUZ, ANTIPOLO RIZAL"
/>
            </div>
          </Field>

        </div>
      </div>

      {/* Section 2 – Remove Meter */}
      {showRemoveMeterSection && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle title="Remove Meter" />

          <Field label="Remove Meter No." >
            <input {...text('remove_meter')} placeholder="e.g. 108BA055151" />
          </Field>

          <Field label="R. Serial Number">
            <input {...text('r_serial_number')} placeholder="e.g. 0824851" />
          </Field>

          <Field label="Demand Seal No. (5) Aerolock">
            <input {...text('demand_seal_aerolock')} placeholder="Seal number" />
          </Field>

          <Field label="Terminal Seal" >
            <input {...text('removed_seal')} placeholder="e.g. A22PT0018882" />
          </Field>

          <Field label="Cabinet Seal (2)">
            <input {...text('cabinet_seal_remove')} placeholder="Cabinet seal" />
          </Field>

          <Field label="Reading (kWh)">
            <input {...text('reading_kwh')} placeholder="e.g. 37812 / NDD / ERROR" />
          </Field>

          {/* A removed meter is either a normal removal or a Meter For Lab
              Test. Only an MFLT needs a booba number and a witnessing date,
              so those two stay disabled until the box is ticked — and become
              required once it is. */}
          <Field label="Removed Meter Type" span2>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="mflt_checklist"
                checked={!!form.mflt_checklist}
                onChange={e => {
                  const on = e.target.checked
                  set('mflt_checklist', on)
                  // Clear the MFLT-only fields when switching back to a normal
                  // removal, so a stale booba number cannot be saved against a
                  // record that is no longer for lab test.
                  if (!on) {
                    set('booba_number', '')
                    set('witness_date', '')
                    setFieldErrors(prev => ({ ...prev, booba_number: false, witness_date: false }))
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mflt_checklist" className="text-sm text-slate-600">
                MFLT — Meter For Lab Test
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Leave unticked for a normal removed meter.
            </p>
          </Field>

          <Field
            label="Booba Number"
            required={!!form.mflt_checklist}
            errorMessage={fieldErrors.booba_number}
          >
            <input
              {...text('booba_number')}
              disabled={!form.mflt_checklist}
              placeholder={form.mflt_checklist ? 'e.g. B25BW0109486' : 'MFLT only'}
              className={`${inputClass} ${fieldErrors.booba_number ? '!border-red-500 !bg-red-200' : ''} disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </Field>

          <Field
            label="Witnessing Date"
            required={!!form.mflt_checklist}
            errorMessage={fieldErrors.witness_date}
          >
            <input
              type="date"
              {...text('witness_date')}
              disabled={!form.mflt_checklist}
              className={`${inputClass} ${fieldErrors.witness_date ? '!border-red-500 !bg-red-200' : ''} disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </Field>
        </div>
      </div>
      )}

      {/* Section 3 – New Installed Meter. Retirement FO keeps only the
          Installed Seal field; a cancelled job keeps none, so the panel
          itself goes rather than being left as an empty white box. */}
      {!isCancelled && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {showInstalledMeterFields && (
            <>
              <SectionTitle title="New Installed Meter" />

              <Field label="Installed Meter No." errorMessage={fieldErrors.ins_meter}>
                <input {...text('ins_meter')} placeholder="e.g. 125BAS076970" />
              </Field>

              <Field label="Serial Number">
                <input {...text('ins_serial_number')} placeholder="e.g. SC1076970" />
              </Field>

              <Field label="Demand Seal (5)">
                <input {...text('demand_seal_installed')} placeholder="Demand seal" />
              </Field>
            </>
          )}

          <Field label="Terminal Seal" >
            <input {...text('installed_seal')} placeholder="e.g. A25PT0196346" />
          </Field>

          {showInstalledMeterFields && (
            <>
              <Field label="Cabinet Seal (2)">
                <input {...text('cabinet_seal_installed')} placeholder="Cabinet seal" />
              </Field>

              <Field label="TLN Tag">
                <input {...text('tln_tag')} placeholder="e.g. 199538" />
              </Field>

              <Field label="Pole Tag">
                <input {...text('pole_tag')} placeholder="e.g. 115-0833" />
              </Field>

              <Field label="MDLTR No.">
                <input {...text('mdltr_no')} placeholder="e.g. 384356" />
              </Field>

              <Field label="Aging (days)">
                <input
                  type="number"
                  value={form.aging ?? ''}
                  onChange={e => set('aging', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. -238"
                />
              </Field>

            </>
          )}
        </div>
      </div>
      )}

      {/* Section 4 – Remarks & Batch. Always shown, but a cancelled job
          keeps only the amount and the remarks. */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionTitle title="Remarks & Batch Information" />

          {/* On a cancelled job none of these apply: no meter came back, no
              crew was paid for the work, and there is no location to pin. */}
          {!isCancelled && (
          <Field label="For Batch">
            <select {...text('for_batch')} className={selectClass}>
              <option value="">— Select —</option>
              {opts('for_batch').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          )}

          {/* A select like every other list here. It was a number input
              with a datalist, which opens the browser's own popup and
              looked nothing like the fields around it. */}
          <Field label="FO Amount (₱)">
            <select {...text('billed_amount')} className={selectClass}>
              <option value="">— Select —</option>
              {opts('billed_amount').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          {!isCancelled && (
          <>
          <Field label="Date Returned">
            <input type="date" {...text('date_returned')} />
          </Field>


          <Field label="Percentage (%)">
            <input {...text('percentage')} placeholder="e.g. 29%" />
          </Field>

          <Field label="Plus Code">
            <input {...text('pluscode')} placeholder="Plus code" />
          </Field>

          <Field label="PlanGrid">
            <input {...text('plangrid')} placeholder="PlanGrid" />
          </Field>
          </>
          )}

          {hasSubmission && (
            <>
              <Field label="Submitted To">
                <input {...text('submitted_to')} list="record-submitted-to-options" placeholder="Who it was submitted to" />
                <datalist id="record-submitted-to-options">
                  {optionsFor('submitted_to', sector).map(o => <option key={o} value={o} />)}
                </datalist>
              </Field>
              <Field label="Date of Submitted">
                <input type="date" {...text('date_submitted')} />
              </Field>
            </>
          )}

          <Field label="Remarks">
  <textarea
    {...text('remarks')}
    rows={3}
    maxLength={100}
    placeholder="e.g. REPLACE METER FOR LABTEST"
    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#D89B00] focus:ring-2 focus:ring-[#D89B00] resize-none"
  />

  <div className="mt-1 text-right text-xs text-gray-500">
    {(form.remarks?.length || 0)}/100 characters
  </div>
</Field>

          {/* A row of thumbnails across the bottom. The pictures are
              uploaded as they are picked, so they are already in place by
              the time the record is saved. */}
          {hasPhotos && (
            <div className="sm:col-span-2 lg:col-span-3">
              <RecordPhotos
                value={form.photos}
                onChange={next => set('photos', next)}
                sector={sector}
              />
            </div>
          )}
        </div>
      </div>


      {/* Sticky Actions */}
<div
  className="fixed
    bottom-0
    left-64
    right-0
    bg-white
    border-t
    border-slate-200
    p-4
    flex
    items-center
    justify-end
    gap-3
    shadow-lg
    z-50
  "
>

  <button
    type="button"
  onClick={() =>
  navigate(
    form.archived_at
      ? '/archived-work-orders'
      : '/field-orders'
  )
}
    className="
      flex
      items-center
      gap-2
      px-5
      py-2
      border
      border-slate-200
      rounded-lg
      text-sm
      text-slate-600
      hover:bg-slate-50
      transition-colors
    "
  >
    <X size={15} />
    Cancel
  </button>


  <button
    type="button"
    onClick={(e) => handleSubmit(e, "pending")}
    disabled={savingPending}
    className="
      flex
      items-center
      gap-2
      px-5
      py-2
      bg-green-600
      hover:bg-green-700
      disabled:opacity-60
      text-white
      rounded-lg
      text-sm
      font-medium
      transition-colors
    "
  >
    {savingPending ? 'Adding...' : `Add to Pending (${pendingRepeat}/${repeatCount})`}
  </button>



  {/* New field orders always go to Pending — Encoders' work needs a
      reviewer, and an Admin adding fresh data gets the same check
      everyone else does. Direct save is only for an already-approved
      record being edited (recordId set) — that update reaches
      field_orders straight away, same as before. */}
  {canManage && recordId && (
  <button
    type="submit"
    disabled={saving}
    className="
      flex
      items-center
      gap-2
      px-5
      py-2
      bg-blue-600
      hover:bg-blue-700
      disabled:opacity-60
      text-white
      rounded-lg
      text-sm
      font-medium
      transition-colors
    "
  >
    <Save size={15} />
    {saving
? 'Saving...'
: 'Update Record'
}
  </button>
  )}


</div>
      </>
      )}
    </form>
  )
}
