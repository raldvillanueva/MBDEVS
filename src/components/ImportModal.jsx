import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSector } from '../lib/SectorContext'
import { fieldOrdersTable } from '../lib/sectorTables'
import { X, Upload, CheckCircle, Download } from 'lucide-react'
 
const DB_FIELDS = [
  { key: 'field_order_no',        label: 'Field Order No.' },
  { key: 'service_number',        label: 'Service ID Number' },
  { key: 'status_crew',           label: 'Status Crew' },
  { key: 'date_assign',           label: 'Date Assign' },
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

const DATE_FIELDS = new Set(['date_assign', 'date_executed', 'witness_date', 'date_returned'])
const NUM_INT_FIELDS = new Set(['aging'])
const NUM_FLOAT_FIELDS = new Set(['billed_amount', 'crew_payrol'])
const BOOL_FIELDS = new Set(['mflt_checklist', 'for_check'])

// Aliases: db field → lowercase CSV header variants
const ALIASES = {
  status_crew:           ['status crew', 'status', 'crew status', 'status_crew'],
  date_assign:           ['date assign', 'date assigned', 'assign date', 'date_assign'],
  for_check:             ['for checking', 'for check', 'chk', 'checked', 'for_check'],
  date_executed:         ['date of executed', 'for checking (2)', 'date exec', 'date executed', 'date executed', 'execution date', 'date_executed', 'for checking (date)'],
  type_of_meter:         ['type of remove meter', 'type of removed meter', 'type of meter', 'meter type', 'type_of_meter'],
  job_description:       ['job description', 'job desc', 'description', 'job_description'],
  crew_name:             ['assigned crew ', 'crew name', 'crew', 'assigned crew', 'crew_name'],
  location:              ['location', 'address'],
  // Every alias is compared against a lowercased header, so an alias with
  // a capital in it can never match. 'service ID number' used to.
  service_number:        ['sin/ssn', 'sin', 'ssn', 'sin / ssn', 'service id number', 'service no', 'service no.', 'acct no', 'account number', 'service #'],
  field_order_no:        ['field order/fo', 'field order no', 'field order no.', 'fo no', 'fo number', 'field order', 'fo#'],
  remove_meter:          ['remove meter', 'removed meter', 'meter removed', 'remove_meter'],
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

function templateHeaders() {
  return DB_FIELDS.map(f => {
    const aliases = ALIASES[f.key] || []
    if (aliases.includes(f.label.toLowerCase().trim())) return f.label
    const fallback = aliases[0]
    return fallback ? fallback.replace(/\b\w/g, c => c.toUpperCase()) : f.label
  })
}

function downloadTemplate() {
  // A header row and nothing else. An example row would be imported
  // along with the real data by anyone who forgot to delete it.
  const csv = '\ufeff' + templateHeaders().join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'field_orders_import_template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function coerce(dbField, raw) {
  if (raw === '' || raw == null) return null
  if (DATE_FIELDS.has(dbField)) {
    const s = String(raw).trim()
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
  const [step, setStep] = useState('upload')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [rowLimit, setRowLimit] = useState('')
  const [rowOffset, setRowOffset] = useState('')
  const fileRef = useRef()

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
      setMapping(autoMap(headers))
      setStep('map')
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  }

  async function doImport() {
    setStep('importing')
    const BATCH = 100
    const offset = rowOffset !== '' ? parseInt(rowOffset) : 0
    const limit = rowLimit !== '' ? parseInt(rowLimit) : csvRows.length
    const rowsToImport = csvRows.slice(offset, offset + limit)
    let done = 0, errors = 0
    const total = rowsToImport.length
    setProgress({ done: 0, total, errors: 0 })

    const payloads = rowsToImport.map((row, i) => {
      const obj = { seq: offset + i + 1 }
      for (const [dbField, csvHeader] of Object.entries(mapping)) {
        if (!csvHeader) continue
        const idx = csvHeaders.indexOf(csvHeader)
        if (idx === -1) continue
        obj[dbField] = coerce(dbField, row[idx] ?? '')
      }
      return obj
    })

    for (let i = 0; i < payloads.length; i += BATCH) {
      const batch = payloads.slice(i, i + BATCH)
      const { error } = await supabase.from(foTable).insert(batch)
      if (error) errors += batch.length
      else done += batch.length
      setProgress({ done: done + errors, total, errors })
    }

    setStep('done')
    if (onImported) onImported()
  }

  const mappedCount = Object.values(mapping).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Import Records</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {step === 'upload' && 'Upload an Excel (.xlsx) or CSV file — columns are matched for you'}
              {step === 'map' && `${csvRows.length} rows found • ${mappedCount} of ${DB_FIELDS.length} columns mapped`}
              {step === 'importing' && `Importing ${progress.done} of ${progress.total}...`}
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

        {/* Somewhere to start from, for anyone being asked to send data
            in. Built from the same field list the matcher uses, so what
            comes back maps itself. */}
        {step === 'upload' && (
          <div className="border-t border-slate-200 px-6 py-3 shrink-0">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              <Download size={15} />
              Download blank template
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Send this to whoever is filling it in. Every column in it is matched
              automatically, so nothing needs mapping by hand.
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

              {/* Column Mapping */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Column Mapping</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {DB_FIELDS.map(({ key, label }) => (
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
              <p className="text-sm text-slate-500 shrink-0">{mappedCount} of {DB_FIELDS.length} fields mapped</p>
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
              <CheckCircle size={52} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-slate-800 font-bold text-xl">Import Complete</p>
              <p className="text-slate-500 text-sm mt-2">
                {(progress.total - progress.errors).toLocaleString()} rows imported successfully
                {progress.errors > 0 && (
                  <span className="text-red-500 block mt-1">{progress.errors} rows failed to insert</span>
                )}
              </p>
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
