import { useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSector } from '../lib/SectorContext'
import { fieldOrdersTable, pendingOrdersTable } from '../lib/sectorTables'
import { X, Upload, CheckCircle, Download, ListPlus, AlertTriangle } from 'lucide-react'
import { useDropdowns } from '../lib/DropdownContext'
import { downloadImportTemplate } from '../lib/importTemplate'
import { useAuth } from '../lib/AuthContext'
import { DROPDOWN_FIELDS, normalizeOption } from '../lib/dropdownLists'
import { useSubmissionColumns, SUBMISSION_COLUMNS } from '../lib/optionalColumns'
 
const DB_FIELDS = [
  { key: 'field_order_no',        label: 'Field Order No.' },
  { key: 'fo_action',             label: 'FO Action' },
  { key: 'service_number',        label: 'Service ID Number' },
  { key: 'submitted_to',          label: 'Submitted To' },
  { key: 'date_submitted',        label: 'Date of Submitted' },
  { key: 'status_crew',           label: 'Status Crew' },
  { key: 'date_assign',           label: 'Date Assign' },
  { key: 'for_check',             label: 'For Check' },
  { key: 'date_executed',         label: 'Date Executed' },
  { key: 'type_of_meter',         label: 'Type of Meter' },
  { key: 'job_description',       label: 'Job Description' },
  { key: 'crew_name',             label: 'Crew Name' },
  { key: 'location',              label: 'Location' },
  { key: 'remove_meter',          label: 'Remove Meter' },
  { key: 'r_serial_number',       label: 'R. Serial Number' },
  { key: 'demand_seal_aerolock',  label: 'Demand Seal Aerolock' },
  { key: 'removed_seal',          label: 'Removed Seal' },
  { key: 'cabinet_seal_remove',   label: 'Cabinet Seal (Remove)' },
  { key: 'reading_kwh',           label: 'Reading (kWh)' },
  { key: 'demand_kwh_cum',        label: 'DEMAND (kWh)/Cum Demand' },
  { key: 'ins_meter',             label: 'Installed Meter' },
  { key: 'ins_serial_number',     label: 'Ins. Serial Number' },
  { key: 'demand_seal_installed', label: 'Demand Seal Installed' },
  { key: 'installed_seal',        label: 'Installed Seal (1)' },
  { key: 'cabinet_seal_installed',label: 'Cabinet Seal (2)' },
  { key: 'tln_tag',               label: 'TLN Tag' },
  { key: 'pole_tag',              label: 'Pole Tag' },
  { key: 'booba_number',          label: 'Booba Number' },
  { key: 'mdltr_no',              label: 'MDLTR No.' },
  { key: 'aging',                 label: 'Aging (days)' },
  { key: 'witness_date',          label: 'Witness Date' },
  { key: 'remarks',               label: 'Remarks' },
  { key: 'mflt_checklist',        label: 'MFLT Checklist' },
  { key: 'fo_type',               label: 'FO Type' },
  { key: 'billed_amount',         label: 'Billed Amount' },
  { key: 'for_batch',             label: 'For Batch' },
  { key: 'date_returned',         label: 'Date Returned' },
  { key: 'crew_payrol',           label: 'Crew Payrol' },
  { key: 'pluscode',              label: 'Plus Code' },
]

const DATE_FIELDS = new Set(['date_assign', 'date_executed', 'witness_date', 'date_returned', 'date_submitted'])
const NUM_INT_FIELDS = new Set(['aging'])
const NUM_FLOAT_FIELDS = new Set(['billed_amount', 'crew_payrol'])
const BOOL_FIELDS = new Set(['mflt_checklist', 'for_check'])

// Aliases: db field → lowercase CSV header variants
const ALIASES = {
  status_crew:           ['status crew', 'status', 'crew status', 'status_crew'],
  fo_action:             ['fo action', 'fo_action', 'action'],
  date_assign:           ['date assign', 'date assigned', 'assign date', 'date_assign'],
  for_check:             ['for checking', 'for check', 'chk', 'checked', 'for_check'],
  date_executed:         ['date of executed', 'for checking (2)', 'date exec', 'date executed', 'date executed', 'execution date', 'date_executed', 'for checking (date)'],
  type_of_meter:         ['type of remove meter', 'type of removed meter', 'type of meter', 'meter type', 'type_of_meter'],
  job_description:       ['job description', 'job desc', 'description', 'job_description'],
  crew_name:             ['assigned crew ', 'crew name', 'crew', 'assigned crew', 'crew_name'],
  location:              ['location', 'address'],
  // Every alias is compared against a lowercased header, so an alias with
  // a capital in it can never match. 'service ID number' used to.
  service_number:        ['sin/ssn', 'sin', 'ssn', 'sin / ssn', 'service id number', 'service number', 'service no', 'service no.', 'acct no', 'account number', 'service #'],
  submitted_to:          ['submitted to', 'submitted_to', 'submit to', 'submitted'],
  date_submitted:        ['date of submitted', 'date submitted', 'date of submission', 'submission date', 'date_submitted'],
  field_order_no:        ['field order/fo', 'field order no', 'field order no.', 'fo no', 'fo number', 'field order', 'fo#'],
  remove_meter:          ['removed meter number', 'remove meter number', 'remove meter', 'removed meter', 'meter removed', 'remove_meter'],
  r_serial_number:       ['r. serial number', 'r serial number', 'removed serial', 'r_serial_number'],
  demand_seal_aerolock:  ['remove (demand seal)', 'remove demand seal', 'demand seal no. (5) aerolock', 'demand seal no. (5)', 'demand seal aerolock', 'aerolock', 'demand_seal_aerolock'],
  removed_seal:          ['remove (t-seal)', 'remove t-seal', 't-seal', 'remove (tseal)', 'removed seal', 'seal removed', 'removed_seal'],
  cabinet_seal_remove:   ['remove (cabinet seal)', 'remove cabinet seal', 'cabinet seal (2)', 'cabinet seal (remove)', 'cabinet seal remove', 'cabinet_seal_remove'],
  reading_kwh:           ['reading (remove meter)', 'reading remove meter', 'reading (kwh)', 'reading kwh', 'kwh reading', 'reading', 'reading_kwh'],
  demand_kwh_cum:        ['demand (kwh)/ cum demand', 'demand (kwh)/cum demand', 'demand kwh', 'cum demand', 'demand_kwh_cum'],
  ins_meter:             ['inst. meter', 'inst meter', 'ins. meter', 'ins meter', 'installed meter', 'new meter', 'meter installed', 'ins_meter'],
  ins_serial_number:     ['serial number', 'installed serial', 'ins serial', 'new serial', 'ins_serial_number'],
  demand_seal_installed: ['demand seal (5)', 'demand seal installed', 'demand seal (installed)', 'demand_seal_installed'],
  installed_seal:        ['install t-seal (1)', 'install t-seal', 'install tseal (1)', 'installed seal (1)', 'installed seal', 'seal installed', 'ins seal', 'installed_seal'],
  cabinet_seal_installed:['install cabinet seal (2)', 'install cabinet seal', 'cabinet seal (2) (2)', 'cabinet seal installed', 'cab seal', 'cabinet_seal_installed'],
  tln_tag:               ['tln tag', 'tln', 'tln_tag'],
  pole_tag:              ['pole tag', 'pole', 'pole_tag'],
  booba_number:          ['booba number', 'booba no', 'booba', 'booba_number'],
  mdltr_no:              ['mdltr no.', 'mdltr no', 'mdltr', 'mdltr_no'],
  aging:                 ['aging', 'age', 'age (days)', 'aging (days)'],
  witness_date:          ['witness date', 'witnessed', 'witness_date'],
  remarks:               ['remarks', 'notes', 'comment', 'comments'],
  mflt_checklist:        ['mflt checklist', 'mflt', 'mflt_checklist'],
  fo_type:               ['fo type', 'fo_type', 'job type'],
  billed_amount:         ['billed amount', 'billed', 'amount billed', 'billed_amount'],
  for_batch:             ['for batch', 'batch', 'batch status', 'for_batch'],
  date_returned:         ['date returned', 'return date', 'date_returned'],
  crew_payrol:           ['crew payroll', 'crew payrol', 'payroll', 'crew_payrol'],
  pluscode:              ['p-code / tln tag / p-tag (location)', 'p-code', 'pcode', 'p code', 'pluscode', 'plus code', 'plus_code'],
}

function parseCSV(text) {
  const cleaned = text.startsWith('﻿') ? text.slice(1) : text
  const rows = []
  let row = [], field = '', inQuotes = false

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i], next = cleaned[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field.trim()); field = '' }
      else if (c === '\n' || (c === '\r' && next === '\n')) {
        if (c === '\r') i++
        row.push(field.trim()); field = ''
        if (row.some(f => f !== '')) rows.push(row)
        row = []
      } else field += c
    }
  }
  if (field || row.length) {
    row.push(field.trim())
    if (row.some(f => f !== '')) rows.push(row)
  }
  return rows
}


function autoMap(headers) {
  const map = {}, used = new Set()
  for (const [dbField, aliases] of Object.entries(ALIASES)) {
    for (const h of headers) {
      const norm = h.toLowerCase().trim()
      if (aliases.includes(norm) && !used.has(h)) {
        map[dbField] = h; used.add(h); break
      }
    }
  }
  return map
}

// Reads the calendar parts rather than using toISOString, which converts to
// UTC and can move a Manila date back a day.
function toISODate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return ''

  // A date in a spreadsheet is a calendar day: no time, no timezone. By the
  // time it reaches here it is a Date, and SheetJS lands it 25 seconds short
  // of midnight when it turns the stored serial back — so reading the
  // calendar parts straight off gave the day before. 2026-09-30 imported as
  // the 29th, on every row with a real date cell.
  //
  // Snapping to the nearest midnight puts it back on the day it was typed,
  // and is read in UTC so the viewer's own timezone cannot shift it again.
  const snapped = new Date(Math.round(d.getTime() / 86400000) * 86400000)
  return `${snapped.getUTCFullYear()}-${String(snapped.getUTCMonth() + 1).padStart(2, '0')}-${String(snapped.getUTCDate()).padStart(2, '0')}`
}

function coerce(dbField, raw) {
  if (raw === '' || raw == null) return null
  if (DATE_FIELDS.has(dbField)) {
    const s = String(raw).trim()

    // A bare number in a date column is an Excel serial — days since
    // 1899-12-30. It reaches us whenever the cell lost its date format
    // somewhere along the way, and without this it would be stored as the
    // literal text "46294".
    if (/^\d+(\.\d+)?$/.test(s)) {
      const serial = Number(s)
      // 1 is 1900-01-01 and 2958465 is 9999-12-31. Outside that it is some
      // other number that happens to be sitting in a date column, and
      // guessing at it would be worse than leaving it empty.
      if (serial >= 1 && serial <= 2958465) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
      return null
    }

    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  if (NUM_INT_FIELDS.has(dbField)) {
    const n = parseInt(raw); return isNaN(n) ? null : n
  }
  if (NUM_FLOAT_FIELDS.has(dbField)) {
    const n = parseFloat(String(raw).replace(/[₱$,]/g, '')); return isNaN(n) ? null : n
  }
  if (BOOL_FIELDS.has(dbField)) {
    if (typeof raw === 'boolean') return raw
    const l = String(raw).toLowerCase()
    return l === 'true' || l === 'yes' || l === '1' || l === 'x' || l === '✓'
  }
  return (raw === '' ? null : raw)
}

export default function ImportModal({ onClose, onImported }) {
  const { sector } = useSector()
  const foTable = fieldOrdersTable(sector)
  const poTable = pendingOrdersTable(sector)
  // Imported rows are somebody else's spreadsheet, not reviewed records,
  // so Pending is the default: they land somewhere they can be checked and
  // completed before anyone treats them as real. Field Orders stays
  // available for a backfill of records that are already finished.
  const [destination, setDestination] = useState('pending')
  const [step, setStep] = useState('upload')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 })
  // What actually went wrong, grouped by reason. A count on its own is
  // no use across twelve thousand rows.
  const [failures, setFailures] = useState([])
  // Rows already on file, left out rather than rejected.
  const [skipped, setSkipped] = useState(0)
  // The first few field order numbers that were already on file. A bare
  // count left people thinking the import had silently failed.
  const [skippedSample, setSkippedSample] = useState([])
  const [showMapping, setShowMapping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [rowLimit, setRowLimit] = useState('')
  const [rowOffset, setRowOffset] = useState('')
  const fileRef = useRef()
  const { optionsFor, byField, usingDefaults, reload: reloadLists } = useDropdowns()
  const { canDelete: canEditLists } = useAuth()
  const [listBusy, setListBusy] = useState(false)
  // Submitted To / Date of Submitted only once the table has those columns.
  const hasSubmission = useSubmissionColumns(sector)
  const fields = hasSubmission ? DB_FIELDS : DB_FIELDS.filter(f => !SUBMISSION_COLUMNS.includes(f.key))
  const [listMessage, setListMessage] = useState('')

  // Values in the file that are not on the dropdown lists. They still
  // import exactly as written — this only makes them visible, so a typo
  // ("REPLAC") or a new job type is noticed before it lands in 500 rows.
  const unknownValues = useMemo(() => {
    const out = []
    for (const f of DROPDOWN_FIELDS) {
      // Submitted To is free text; its list is only suggestions.
      if (f.freeText) continue
      const header = mapping[f.key]
      if (!header) continue
      const idx = csvHeaders.indexOf(header)
      if (idx === -1) continue
      const key = v => {
        if (!f.numeric) return normalizeOption(v)
        const n = parseFloat(String(v).replace(/[₱$,]/g, ''))
        return Number.isFinite(n) ? String(n) : normalizeOption(v)
      }
      const known = new Set(optionsFor(f.key, sector).map(key))
      const counts = new Map()
      for (const row of csvRows) {
        const raw = String(row[idx] ?? '').trim()
        if (!raw) continue
        const k = key(raw)
        if (known.has(k)) continue
        const hit = counts.get(k)
        if (hit) hit.count++
        else counts.set(k, { value: f.numeric ? k : normalizeOption(raw), count: 1 })
      }
      if (counts.size) out.push({ field: f, values: [...counts.values()].sort((a, b) => b.count - a.count) })
    }
    return out
  }, [mapping, csvHeaders, csvRows, optionsFor, sector])

  // entry: { field, values }. Pass only some values to add just those.
  async function addUnknownToList(entry) {
    setListBusy(true)
    setListMessage('')
    // Hidden values count as existing — restoring them is done on the
    // Dropdown Lists page, not by adding a duplicate.
    const existing = new Set((byField[entry.field.key] || []).map(r => normalizeOption(r.value)))
    const maxOrder = (byField[entry.field.key] || []).reduce((m, r) => Math.max(m, r.sort_order || 0), 0)
    const fresh = entry.values.map(v => v.value).filter(v => !existing.has(normalizeOption(v)))
    const skipped = entry.values.length - fresh.length
    if (fresh.length) {
      const { error } = await supabase.from('dropdown_options').insert(
        fresh.map((value, i) => ({ field: entry.field.key, value, sort_order: maxOrder + (i + 1) * 10 })),
      )
      if (error) {
        setListBusy(false)
        setListMessage(`Could not add to ${entry.field.label}: ${error.message}`)
        return
      }
    }
    await reloadLists()
    setListBusy(false)
    setListMessage(
      `Added ${fresh.length} value${fresh.length === 1 ? '' : 's'} to ${entry.field.label}.` +
      (skipped ? ` ${skipped} ${skipped === 1 ? 'is' : 'are'} on the list but hidden — restore ${skipped === 1 ? 'it' : 'them'} on the Dropdown Lists page.` : ''),
    )
  }

  // Everything below works on an array of rows, so each format only has
  // to get itself into that shape.
  async function rowsFromSheet(buffer) {
    // cellDates keeps real dates as Date objects rather than Excel serial
    // numbers — 45658 would otherwise be imported as the number 45658.
    // Loaded on demand. The sheet parser is about 400 kB, and everyone
    // who never imports a file should not be paying for it on every page
    // load.
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return []
    // defval keeps empty cells as empty strings so a blank column does
    // not shift every value after it one place to the left.
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
  }

  function handleFile(file) {
    if (!file) return

    const name = file.name.toLowerCase()
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')
    const isCsv = name.endsWith('.csv')

    if (!isExcel && !isCsv) {
      alert('Please select a .csv or Excel (.xlsx) file.')
      return
    }

    const reader = new FileReader()
    reader.onload = async e => {
      let parsed
      try {
        parsed = isExcel
          ? await rowsFromSheet(new Uint8Array(e.target.result))
          : parseCSV(e.target.result)
      } catch {
        alert('That file could not be read. If it is an Excel file, try re-saving it.')
        return
      }

      // A sheet cell can hold a number, a Date or a boolean. Everything
      // downstream expects text, so normalise once here rather than
      // guarding at every use.
      parsed = parsed.map(r => r.map(cell =>
        // Dates become text here rather than being carried through as
        // objects. The preview table renders these cells straight out, and
        // React throws on an object child — which takes the whole page down
        // rather than showing a bad cell.
        cell instanceof Date ? toISODate(cell) : (cell == null ? '' : String(cell).trim()),
      ))

      if (parsed.length < 2) { alert('File is empty or has no data rows.'); return }

      const allAliases = Object.values(ALIASES).flat()
      let headerIdx = 0, bestScore = -1
      for (let i = 0; i < Math.min(5, parsed.length); i++) {
        const score = parsed[i].filter(cell => typeof cell === 'string' && allAliases.includes(cell.toLowerCase().trim())).length
        if (score > bestScore) { bestScore = score; headerIdx = i }
      }

      const seen = {}
      const headers = parsed[headerIdx].map(h => {
        const clean = String(h).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
        const k = clean.toLowerCase()
        seen[k] = (seen[k] || 0) + 1
        return seen[k] > 1 ? `${clean} (${seen[k]})` : clean
      })
      const dataRows = parsed.slice(headerIdx + 1).filter(r => r.some(c => c !== ''))
      setCsvHeaders(headers)
      setCsvRows(dataRows)
      const auto = autoMap(headers)
      if (!hasSubmission) for (const c of SUBMISSION_COLUMNS) delete auto[c]
      setMapping(auto)
      setStep('map')
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  }

  // Every field order number already on file, from both tables. Checked
  // against Field Orders as well as Pending: a record that has already
  // been reviewed and moved on must not come back as a new pending row.
  //
  // Paged, because PostgREST caps a response at 1,000 and a silent cap
  // here would quietly let the rest back in as duplicates.
  async function existingFieldOrderNumbers() {
    const seen = new Set()
    for (const table of [poTable, foTable]) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from(table)
          .select('field_order_no')
          .not('field_order_no', 'is', null)
          .range(from, from + 999)
        if (error || !data || data.length === 0) break
        for (const r of data) seen.add(String(r.field_order_no).trim().toUpperCase())
        if (data.length < 1000) break
      }
    }
    return seen
  }

  async function doImport() {
    setStep('importing')
    setFailures([])
    setSkipped(0)
    setSkippedSample([])
    // Bigger batches mean far fewer round trips — 12,000 rows is 24
    // requests at this size rather than 120. A batch that fails is
    // retried row by row below, so the size costs nothing in accuracy.
    const BATCH = 500
    const table = destination === 'fieldOrders' ? foTable : poTable
    const offset = rowOffset !== '' ? parseInt(rowOffset) : 0
    const limit = rowLimit !== '' ? parseInt(rowLimit) : csvRows.length
    const rowsToImport = csvRows.slice(offset, offset + limit)
    let done = 0, errors = 0

    const alreadyOnFile = await existingFieldOrderNumbers()
    const seenInThisFile = new Set()
    const skippedNumbers = []
    const payloads = []
    let duplicates = 0

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i]
      const obj = {}
      for (const [dbField, csvHeader] of Object.entries(mapping)) {
        if (!csvHeader) continue
        if (!hasSubmission && SUBMISSION_COLUMNS.includes(dbField)) continue
        const idx = csvHeaders.indexOf(csvHeader)
        if (idx === -1) continue
        obj[dbField] = coerce(dbField, row[idx] ?? '')
      }

      // The same export is downloaded again each time with new rows added,
      // so most of a file is usually already here. Matching on the field
      // order number, ignoring case and stray spaces.
      const key = String(obj.field_order_no ?? '').trim().toUpperCase()
      if (key && (alreadyOnFile.has(key) || seenInThisFile.has(key))) {
        duplicates++
        if (skippedNumbers.length < 8) skippedNumbers.push(obj.field_order_no)
        continue
      }
      if (key) seenInThisFile.add(key)

      // seq orders the Field Orders table and exists only there. Setting it
      // on a pending row made Postgres reject the whole insert for a column
      // that is not on that table, so nothing reached Pending at all.
      //
      // Numbered over the rows actually kept, so the sequence has no gaps
      // where duplicates were dropped.
      if (destination === 'fieldOrders') obj.seq = offset + payloads.length + 1
      payloads.push(obj)
    }

    setSkipped(duplicates)
    setSkippedSample(skippedNumbers)

    const total = payloads.length
    setProgress({ done: 0, total, errors: 0 })

    // Reason -> { count, firstRow, message }. Twenty distinct reasons is
    // already more than anyone will read; the counts still add up.
    const reasons = new Map()
    function noteFailure(message, rowNumber) {
      const key = String(message || 'Unknown error').slice(0, 200)
      const seen = reasons.get(key)
      if (seen) seen.count++
      else if (reasons.size < 20) reasons.set(key, { count: 1, firstRow: rowNumber, message: key })
    }

    for (let i = 0; i < payloads.length; i += BATCH) {
      const batch = payloads.slice(i, i + BATCH)
      const { error } = await supabase.from(table).insert(batch)

      if (!error) {
        done += batch.length
      } else {
        // Postgres rejects the whole statement when one row is bad, so a
        // single duplicate would otherwise take 499 good rows down with
        // it. Retry them one at a time: slow, but only for the batch that
        // actually had a problem, and only the real offenders are lost.
        for (let j = 0; j < batch.length; j++) {
          const { error: rowError } = await supabase.from(table).insert([batch[j]])
          if (rowError) {
            errors++
            noteFailure(rowError.message, offset + i + j + 2)
          } else {
            done++
          }
          if (j % 25 === 0) setProgress({ done: done + errors, total, errors })
        }
      }

      setProgress({ done: done + errors, total, errors })
    }

    setFailures([...reasons.values()].sort((a, b) => b.count - a.count))
    setStep('done')
    if (onImported) onImported()
  }

  const mappedCount = Object.values(mapping).filter(Boolean).length
  const usedHeaders = new Set(Object.values(mapping).filter(Boolean))
  const unusedHeaders = csvHeaders.filter(h => h && !usedHeaders.has(h))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Import Records</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {step === 'upload' && 'Upload an Excel (.xlsx) or CSV file — columns are matched for you'}
              {step === 'map' && `${csvRows.length} rows found • ${mappedCount} of ${fields.length} columns mapped`}
              {step === 'importing' && `Importing ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}…`}
              {step === 'done' && 'Import complete'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]) }}
              className={`w-full border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <Upload size={40} className="mx-auto text-slate-400 mb-3" />
              <p className="text-slate-700 font-semibold text-base">Drop a file here or click to browse</p>
              <p className="text-slate-400 text-sm mt-1">Excel (.xlsx) or CSV</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.xlsm" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          </div>
        )}

        {/* Somewhere to start from, for anyone being asked to send data in. */}
        {step === 'upload' && (
          <div className="shrink-0 border-t border-slate-200 px-6 py-3">
            <button
              onClick={() => downloadImportTemplate().catch(() => {})}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <Download size={15} />
              Download blank template (Excel)
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Send this to whoever is filling it in. It opens in Excel or Google Sheets
              with the same columns and colours as the sheet they already use, and every
              one is matched automatically when it comes back.
            </p>
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">

              {/* Preview */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Preview — first 3 rows</p>
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr style={{ background: '#1e293b' }}>
                        {csvHeaders.map(h => (
                          <th key={h} className="px-3 py-2 text-left text-slate-300 whitespace-nowrap font-medium border-r border-slate-700 last:border-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis border-r border-slate-100 last:border-0">{cell || <span className="text-slate-300">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {unknownValues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800">
                    Some values in this file are not on the dropdown lists
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    They will still be imported exactly as written. Check for typos first
                    {canEditLists && !usingDefaults ? ' — then click a value to add just that one to the list, or add them all' : ''}.
                  </p>
                  {unknownValues.map(entry => (
                    <div key={entry.field.key} className="mt-2 border-t border-amber-100 pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-amber-900">{entry.field.label}</p>
                        {canEditLists && !usingDefaults && (
                          <button
                            type="button"
                            onClick={() => addUnknownToList(entry)}
                            disabled={listBusy}
                            className="flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <ListPlus size={12} /> Add {entry.values.length === 1 ? 'it' : `all ${entry.values.length}`} to the list
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.values.slice(0, 20).map(v => (
                          canEditLists && !usingDefaults ? (
                            <button
                              key={v.value}
                              type="button"
                              disabled={listBusy}
                              onClick={() => addUnknownToList({ field: entry.field, values: [v] })}
                              title={`Add ${v.value} to the ${entry.field.label} list`}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              + {v.value} <span className="text-amber-500">({v.count.toLocaleString()})</span>
                            </button>
                          ) : (
                            <span key={v.value} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-amber-900">
                              {v.value} <span className="text-amber-500">({v.count.toLocaleString()})</span>
                            </span>
                          )
                        ))}
                        {entry.values.length > 20 && <span className="text-[11px] text-amber-700">+{entry.values.length - 20} more</span>}
                      </div>
                    </div>
                  ))}
                  {listMessage && <p className="mt-2 text-[11px] text-amber-900">{listMessage}</p>}
                </div>
              )}

              {/* Where the rows land. Pending is the default because an
            imported sheet is somebody else's data, not a reviewed record. */}
        <div className="mb-4 rounded-lg border border-[#D9D9D9] bg-slate-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Import into</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'pending', label: 'Pending Records', hint: 'to be checked and completed first' },
              { value: 'fieldOrders', label: 'Field Orders', hint: 'already-finished records' },
            ].map(o => (
              <button
                key={o.value}
                onClick={() => setDestination(o.value)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                  destination === o.value
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-[#D9D9D9] bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-[11px] opacity-70">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Column Mapping. Hidden by default: the template pins the
            columns, so the grid of thirty-odd dropdowns is noise unless
            something actually failed to match. */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {mappedCount} column{mappedCount === 1 ? '' : 's'} matched
                  </p>
                  <button
                    onClick={() => setShowMapping(v => !v)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {showMapping ? 'Hide column mapping' : 'Change column mapping'}
                  </button>
                </div>

                {/* Naming the columns nothing claimed. Hunting for them
                    across thirty-odd dropdowns is the slow way to find out
                    which ones still need a home. */}
                {unusedHeaders.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">
                      {unusedHeaders.length} column{unusedHeaders.length === 1 ? '' : 's'} in your file
                      {unusedHeaders.length === 1 ? ' is' : ' are'} not being imported
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      {unusedHeaders.join(' · ')}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-600">
                      Use Change column mapping above to bring one in, or leave them out.
                    </p>
                  </div>
                )}
                <div className={`grid grid-cols-2 gap-x-6 gap-y-1.5 ${showMapping ? '' : 'hidden'}`}>
                  {fields.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-36 shrink-0 truncate">{label}</span>
                      <select
                        value={mapping[key] || ''}
                        onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white min-w-0"
                      >
                        <option value="">— skip —</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="shrink-0 px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 gap-3">
              <p className="text-sm text-slate-500 shrink-0">{mappedCount} of {fields.length} fields mapped</p>
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-slate-500 shrink-0">Start row:</label>
                <input
                  type="number"
                  min="0"
                  max={csvRows.length - 1}
                  placeholder="0"
                  value={rowOffset}
                  onChange={e => setRowOffset(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="text-xs text-slate-500 shrink-0">Limit:</label>
                <input
                  type="number"
                  min="1"
                  max={csvRows.length}
                  placeholder="all"
                  value={rowLimit}
                  onChange={e => setRowLimit(e.target.value)}
                  className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={doImport}
                  disabled={mappedCount === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
                >
                  {(() => {
                    const off = rowOffset !== '' ? parseInt(rowOffset) || 0 : 0
                    const lim = rowLimit !== '' ? parseInt(rowLimit) || 0 : csvRows.length
                    const count = Math.min(lim, csvRows.length - off)
                    return `Import ${Math.max(0, count).toLocaleString()} rows`
                  })()}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center w-full max-w-xs">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-3">Importing records…</p>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-slate-500 text-sm mt-2">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              {/* A green tick over "0 rows imported" reads as success. If
                  nothing landed, say so with the colour as well as the
                  number. */}
              {progress.total - progress.errors > 0 ? (
                <CheckCircle size={52} className="mx-auto mb-3 text-emerald-500" />
              ) : (
                <AlertTriangle size={52} className="mx-auto mb-3 text-amber-500" />
              )}
              <p className="text-slate-800 font-bold text-xl">
                {progress.total - progress.errors > 0 ? 'Import Complete' : 'Nothing was imported'}
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {(progress.total - progress.errors).toLocaleString()} rows imported successfully
                {progress.errors > 0 && (
                  <span className="text-red-500 block mt-1">
                    {progress.errors.toLocaleString()} rows failed
                  </span>
                )}
              </p>

              {skipped > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left">
                  <p className="text-xs font-semibold text-slate-700">
                    {skipped.toLocaleString()} row{skipped === 1 ? '' : 's'} already on file, left as
                    {skipped === 1 ? ' it was' : ' they were'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {skippedSample.filter(Boolean).join(' · ')}
                    {skipped > skippedSample.length && ` and ${(skipped - skippedSample.length).toLocaleString()} more`}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    These already exist in Pending Records or Field Orders, so they were
                    not added again.
                  </p>
                </div>
              )}

              {failures.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left">
                  <p className="mb-1.5 text-xs font-semibold text-red-800">Why they failed</p>
                  {failures.map((f, i) => (
                    <div key={i} className="border-t border-red-100 py-1.5 first:border-0 first:pt-0">
                      <p className="text-xs text-red-700">{f.message}</p>
                      <p className="mt-0.5 text-[11px] text-red-400">
                        {f.count.toLocaleString()} row{f.count === 1 ? '' : 's'} · first at line {f.firstRow.toLocaleString()} of your file
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
