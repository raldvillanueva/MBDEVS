import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSector } from '../lib/SectorContext'
import { fieldOrdersTable } from '../lib/sectorTables'
import { ChevronLeft, ChevronRight, X, Save, Download, Archive, Send, Info } from 'lucide-react'
import RequestDeletionModal from '../components/RequestDeletionModal'
import RequestEditModal from '../components/RequestEditModal'
import { useAuth } from '../lib/AuthContext'
import { displayAgingDays, agingLevel, dueDaysLeft, dueLevel } from '../lib/aging'
import { logAudit, AUDIT_ACTIONS } from '../lib/auditLog'
import { useDropdowns } from '../lib/DropdownContext'
import { useColumnOptions } from '../lib/useColumnOptions'
import { emptyFilters, applyFiltersToQuery, hasActiveFilters, filterField, ruleIsComplete, withoutColumns } from '../lib/recordFilters'
import { useFilterColumns, withSubmission, SUBMISSION_COLUMNS } from '../lib/optionalColumns'
import FilterBar from '../components/filters/FilterBar'
import { FloatingPanel, ValuePicker, RuleEditor } from '../components/filters/FilterControls'

const PAGE_SIZE = 50

// Once a record is in Field Orders it is the record of what happened, so
// the direct edit only moves the three things that genuinely still change
// afterwards. Anything else is a correction, and corrections go through
// Request Edit where somebody reviews them.
// Submitted To / Date of Submitted are filled in after the job, when the
// record is already here, so they stay directly editable too.
const FIELD_ORDER_EDITABLE = ['status_crew', 'for_check', 'for_batch', 'submitted_to', 'date_submitted']

// Aging and Due Date are worked out in the browser, so there is no column
// to sort on — they order by the date they are derived from instead.
// Aging counts up as its date gets older, so it runs against date_executed;
// Due Date counts down as its date gets older, so it runs with witness_date.
const SORT_FIELDS = {
  aging:    { column: 'date_executed', invert: true },
  due_date: { column: 'witness_date',  invert: false },
}

// Type of Meter, Job Description, FO Type, For Batch and Billed Amount come
// from the Dropdown Lists page (useDropdowns). Search, filters and the
// Year/Month period live in one `filters` object — see lib/recordFilters.js.

// Column → the filter it opens from its header. Aging is worked out from
// Date Executed, so it filters on that; Due Date has no filter.
function headerFilterKey(colKey) {
  if (colKey === 'aging') return 'aging_days'
  if (colKey === 'due_date') return null
  return filterField(colKey) ? colKey : null
}

// Fetching everything that matches, for the export. The server hands back
// at most 1,000 rows per request, so this pages through.
const EXPORT_CHUNK = 1000

const EMPTY_FORM = {
  status_crew: 'FOR ASSIGN', date_assign: '', for_check: false, date_executed: '', type_of_meter: '',
  job_description: '', crew_name: '', location: '', service_number: '', field_order_no: '',
  remove_meter: '', r_serial_number: '', demand_seal_aerolock: '', removed_seal: '',
  cabinet_seal_remove: '', reading_kwh: '', demand_kwh_cum: '', ins_meter: '', ins_serial_number: '',
  demand_seal_installed: '', installed_seal: '', cabinet_seal_installed: '', tln_tag: '',
  pole_tag: '', booba_number: '', mdltr_no: '', aging: '', witness_date: '', remarks: '',
  mflt_checklist: false, fo_type: '', billed_amount: '', for_batch: '', date_returned: '',
  crew_payrol: '', percentage: '', pluscode: '', plangrid: '',
  submitted_to: '', date_submitted: '',
}

function StatusBadge({ status }) {
  const s = status?.toUpperCase() || ''
  if (s === 'CANCEL') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">CANCEL</span>
  if (s.includes('FIELD')) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">FIELD COMPL.</span>
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{status || '—'}</span>
}

function FoTypeBadge({ type }) {
  const t = type?.toUpperCase() || ''
  if (t === 'REPLACE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">REPLACE</span>
  if (t === 'RETIRE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">RETIRE</span>
  if (t === 'REMOVE') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">REMOVE</span>
  if (t === 'CANCEL') return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">CANCEL</span>
  return <span className="text-slate-400 text-xs">{type || '—'}</span>
}

const iCls = 'w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function PF({ label, children, span2 }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function PS({ title, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-1 pb-1.5 border-b border-slate-100">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

const COLS = [
  // — MAIN DATA —
  { label: 'FIELD ORDER/FO',      key: 'field_order_no',        w: 145, mono: true, render: r => r.field_order_no || '—' },
  { label: 'JOB DESCRIPTION',     key: 'job_description',       w: 120, render: r => r.job_description || '—' },
  { label: 'CREW NAME',           key: 'crew_name',             w: 130, render: r => r.crew_name || '—' },
  { label: 'DATE EXECUTED',       key: 'date_executed',         w: 140, render: r => r.date_executed || '—' },
  { label: 'STATUS CREW',         key: 'status_crew',           w: 120, render: r => <StatusBadge status={r.status_crew} /> },
  { label: 'CHECK',               key: 'for_check',             w: 80,  render: r => r.for_check ? <span className="text-emerald-600 font-bold">✓</span> : '' },
  { label: 'DATE ASSIGN',         key: 'date_assign',           w: 105, render: r => r.date_assign || '—' },
  { label: 'TYPE OF METER',       key: 'type_of_meter',         w: 130, render: r => r.type_of_meter || '—' },
  { label: 'SERVICE ID NUMBER',      key: 'service_number',        w: 135, render: r => r.service_number || '—' },
  // Shown only once the database has these columns (lib/optionalColumns.js).
  { label: 'SUBMITTED TO',        key: 'submitted_to',          w: 130, render: r => r.submitted_to || '—' },
  { label: 'DATE OF SUBMITTED',   key: 'date_submitted',        w: 140, render: r => r.date_submitted || '—' },
  // — REMOVE METER —
  { label: 'REMOVE METER',        key: 'remove_meter',          w: 130, render: r => r.remove_meter || '—' },
  { label: 'R. SERIAL NUMBER',    key: 'r_serial_number',       w: 130, render: r => r.r_serial_number || '—' },
  { label: 'DEMAND SEAL NO.5',    key: 'demand_seal_aerolock',  w: 140, render: r => r.demand_seal_aerolock || '—' },
  { label: 'REMOVED SEAL',        key: 'removed_seal',          w: 120, render: r => r.removed_seal || '—' },
  { label: 'CABINET SEAL (2)',     key: 'cabinet_seal_remove',   w: 130, render: r => r.cabinet_seal_remove || '—' },
  { label: 'READING (kWh)',        key: 'reading_kwh',           w: 115, render: r => r.reading_kwh || '—' },
  { label: 'DEMAND/Cum (kWh)', key: 'demand_kwh_cum',    w: 130, render: r => r.demand_kwh_cum || '—' },
  // — NEW INSTALLED METER —
  { label: 'INS. METER',          key: 'ins_meter',             w: 130, render: r => r.ins_meter || '—' },
  { label: 'SERIAL NUMBER',       key: 'ins_serial_number',     w: 130, render: r => r.ins_serial_number || '—' },
  { label: 'DEMAND SEAL (5)',      key: 'demand_seal_installed', w: 130, render: r => r.demand_seal_installed || '—' },
  { label: 'INSTALLED SEAL (1)',   key: 'installed_seal',        w: 130, render: r => r.installed_seal || '—' },
  { label: 'CABINET SEAL (2)',     key: 'cabinet_seal_installed',w: 130, render: r => r.cabinet_seal_installed || '—' },
  // — OTHER INFO —
  { label: 'TLN TAG',             key: 'tln_tag',               w: 90,  render: r => r.tln_tag || '—' },
  { label: 'POLE TAG',            key: 'pole_tag',              w: 90,  render: r => r.pole_tag || '—' },
  { label: 'BOOBA NUMBER',        key: 'booba_number',          w: 115, render: r => r.booba_number || '—' },
  { label: 'MDLTR NO.',           key: 'mdltr_no',              w: 90,  render: r => r.mdltr_no || '—' },
  { label: 'AGING',               key: 'aging',                 w: 70,  render: r => {
      // A checked record has been dealt with, so how long it has been
      // sitting stops being a question worth asking. Blanking it keeps the
      // column to rows that still need chasing.
      if (r.for_check) return <span className="text-slate-300">—</span>
      const days = displayAgingDays(r)
      if (days == null) return '—'
      // Yellow from the warning threshold, red past the overdue one.
      // A batched or returned meter is neither — it has come home.
      const level = agingLevel(r)
      const tint =
        level === 'critical' ? 'text-red-600 font-bold'
        : level === 'warning' ? 'text-amber-600 font-bold'
        : ''
      return <span className={tint}>{days}</span>
    }
  },
  { label: 'WITNESS DATE',        key: 'witness_date',          w: 115, render: r => r.witness_date || '—' },
  { label: 'DUE DATE',            key: 'due_date',              w: 90,  render: r => {
      // Same as Aging: once it is checked there is nothing left to be due.
      if (r.for_check) return <span className="text-slate-300">—</span>
      // Days left on the witnessing clock, not a calendar date: it counts
      // down from 21 so the number itself says how much time is left.
      const left = dueDaysLeft(r)
      if (left == null) return '—'
      const tint = dueLevel(r) === 'ok' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'
      return <span className={tint}>{left}</span>
    }
  },
  { label: 'REMARKS',             key: 'remarks',               w: 200, render: r => r.remarks || '—' },
  { label: 'LOCATION',            key: 'location',              w: 260, render: r => r.location || '—' },
  { label: 'MFLT CHECKLIST',      key: 'mflt_checklist',        w: 110, render: r => r.mflt_checklist ? <span className="text-emerald-600 font-bold">✓</span> : '' },
  { label: 'FO TYPE',             key: 'fo_type',               w: 90,  render: r => <FoTypeBadge type={r.fo_type} /> },
  { label: 'BILLED AMOUNT',       key: 'billed_amount',         w: 110, render: r => r.billed_amount != null ? `₱${parseFloat(r.billed_amount).toFixed(2)}` : '—' },
  { label: 'FOR BATCH',           key: 'for_batch',             w: 100, render: r => r.for_batch?.toUpperCase().includes('ALREADY') ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">Batched</span> : <span className="text-slate-300">—</span> },
  { label: 'DATE RETURNED',       key: 'date_returned',         w: 115, render: r => r.date_returned || '—' },
  { label: 'CREW PAYROLL',        key: 'crew_payrol',           w: 110, render: r => r.crew_payrol != null ? `₱${r.crew_payrol}` : '—' },
  { label: 'PLUSCODE',            key: 'pluscode',              w: 90,  render: r => r.pluscode || '—' },
  { label: 'PLANGRID',            key: 'plangrid',              w: 110, render: r => r.plangrid || '—' },
]

// Columns pinned to the left (Field Order → Check). Everything after this —
// starting with Date Assign — lives in the horizontally-scrollable table.
const FROZEN_COL_COUNT = 6
const FROZEN_COLS = COLS.slice(0, FROZEN_COL_COUNT)
const SCROLL_COLS = COLS.slice(FROZEN_COL_COUNT)

export default function FieldOrders() {
  const { sector } = useSector()
  const foTable = fieldOrdersTable(sector)
  const { role, session, profile, canEncode, canManage, canDelete } = useAuth()
  const { optionsFor } = useDropdowns()
  // Filter values = the dropdown list + what is actually in the records.
  const getOptions = useColumnOptions({ page: 'field_orders', sector })
  // New columns the database may not have yet, and columns the Super Admin
  // switched filtering off for (System Settings → General).
  const { hasSubmission, missing, disabled, hidden } = useFilterColumns(sector)
  const scrollCols = hasSubmission ? SCROLL_COLS : SCROLL_COLS.filter(c => !SUBMISSION_COLUMNS.includes(c.key))
  const exportFields = f => hasSubmission || !SUBMISSION_COLUMNS.includes(f.key)
  // canManage covers Admin and up — everything except permanent delete,
  // which is canDelete.
  const isAdmin = canManage || role === 'admin'
  // Only an Encoder goes through the request flow — Viewer cannot edit at
  // all, and Admin/Super Admin can still save directly, same as before.
  const canRequestEdit = canEncode && !isAdmin

  // Locking an Encoder out of these would leave Request Edit with nothing
  // to propose, so the lock lands on the people whose edits save straight
  // to the record.
  const fieldLocked = key => isAdmin && !FIELD_ORDER_EDITABLE.includes(key)
  const [showDeletionRequest, setShowDeletionRequest] = useState(false)
  const [showEditRequest, setShowEditRequest] = useState(false)
  const [pendingChanges, setPendingChanges] = useState(null)
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(emptyFilters)
  // What actually applies: switched-off or missing columns dropped, so the
  // count, the table, the export and "Select all" all mean the same rows.
  const effective = useMemo(() => withoutColumns(filters, hidden), [filters, hidden])
  const [loadError, setLoadError] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  // The header filter that is open: { fieldKey, anchorRect, options }.
  const [headerFilter, setHeaderFilter] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [hoverRowId, setHoverRowId] = useState(null)
  const leftScrollRef = useRef(null)
  const rightScrollRef = useRef(null)
  const syncingScroll = useRef(false)
  const snapTimeout = useRef(null)
  const navigate = useNavigate()
  const [selectedRows,setSelectedRows]=useState([])
  const [selectAllPages, setSelectAllPages] = useState(false)

function deleteSelected() {
  const count = selectAllPages ? total : selectedRows.length
  setConfirm({
    message: `Delete ${count.toLocaleString()} record${count > 1 ? 's' : ''}? This cannot be undone.`,
    onConfirm: async () => {
      if (selectAllPages) {
        let q = supabase.from(foTable).delete().is('archived_at', null)
        // Exactly the filters on screen — the same function that loads the
        // table — so "all N records" means the N the person is looking at.
        // (Before, the Year/Month filter was left out here, so a bulk action
        // on "March 2025" reached every month.)
        q = hasActiveFilters(effective)
          ? applyFiltersToQuery(q, effective, { page: 'field_orders', missing })
          : q.neq('id', '00000000-0000-0000-0000-000000000000')
        await q
      } else {
        await supabase.from(foTable).delete().in('id', selectedRows)
      }
      logAudit({
        session, profile, sector,
        action: AUDIT_ACTIONS.RECORD_DELETED,
        targetLabel: selectAllPages ? 'All filtered records' : (records.find(r => r.id === selectedRows[0])?.field_order_no || null),
        details: { count },
      })
      setSelectedRows([])
      setSelectAllPages(false)
      fetchRecords()
      setConfirm(null)
    }
  })
}
function archiveSelected() {
  const count = selectAllPages ? total : selectedRows.length
  setConfirm({
    message: `Archive ${count.toLocaleString()} record${count > 1 ? 's' : ''}?`,
    confirmLabel: 'Yes, archive',
    tone: 'archive',
    onConfirm: async () => {
      if (selectAllPages) {
        let q = supabase.from(foTable).update({ archived_at: new Date().toISOString() }).is('archived_at', null)
        // Exactly the filters on screen — the same function that loads the
        // table — so "all N records" means the N the person is looking at.
        // (Before, the Year/Month filter was left out here, so a bulk action
        // on "March 2025" reached every month.)
        q = hasActiveFilters(effective)
          ? applyFiltersToQuery(q, effective, { page: 'field_orders', missing })
          : q.neq('id', '00000000-0000-0000-0000-000000000000')
        await q
      } else {
        await supabase.from(foTable).update({ archived_at: new Date().toISOString() }).in('id', selectedRows)
      }
      logAudit({
        session, profile, sector,
        action: AUDIT_ACTIONS.RECORD_ARCHIVED,
        targetLabel: selectAllPages ? 'All filtered records' : (records.find(r => r.id === selectedRows[0])?.field_order_no || null),
        details: { count },
      })
      setSelectedRows([])
      setSelectAllPages(false)
      fetchRecords()
      setConfirm(null)
    }
  })
}
function toggleRow(id){

setSelectedRows(prev=>

prev.includes(id)

?
prev.filter(x=>x!==id)

:

[...prev,id]

)

}

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from(foTable)
      .select('*', { count: 'exact' })
      .is('archived_at', null)

    // Sorting happens here rather than over `records`: only one page is
    // loaded at a time, so sorting what is on screen would reorder 50 rows
    // out of 8,000 and call it sorted.
    if (sortKey) {
      const spec = SORT_FIELDS[sortKey] || { column: sortKey, invert: false }
      const ascending = spec.invert ? sortDir === 'desc' : sortDir === 'asc'
      q = q.order(spec.column, { ascending, nullsFirst: false })
           // Rows sharing a value would otherwise come back in whatever
           // order Postgres felt like, and could repeat or vanish across
           // pages. id breaks the tie so paging stays stable.
           .order('id', { ascending: true })
    } else {
      q = q.order('seq', { ascending: true, nullsFirst: true })
           .order('created_at', { ascending: false })
    }

    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    q = applyFiltersToQuery(q, effective, { page: 'field_orders', missing })

    const { data, count, error } = await q
    if (!error) { setRecords(data); setTotal(count); setLoadError('') }
    else {
      // Say so, rather than showing "No records found" for a failed load.
      console.error('Could not load field orders', error)
      setLoadError('The records could not be loaded with these filters. Try removing the last filter you added.')
    }
    setLoading(false)
  }, [foTable, page, sortKey, sortDir, effective, missing])

useEffect(() => { 
  fetchRecords() 
}, [fetchRecords])


useEffect(() => {
  setPage(0)
  setSelectAllPages(false)
  setSelectedRows([])
}, [sortKey, sortDir, effective])


  const ROW_HEIGHT = 33
  const rafId = useRef(null)
  const isSnapping = useRef(false)

  function snapToRow() {
    const el = rightScrollRef.current
    if (!el) return
    const snapped = Math.round(el.scrollTop / ROW_HEIGHT) * ROW_HEIGHT
    const delta = snapped - el.scrollTop
    if (delta !== 0) {
      isSnapping.current = true
      el.scrollTo({ top: snapped, behavior: 'smooth' })
      leftScrollRef.current?.scrollTo({ top: snapped, behavior: 'smooth' })
      setTimeout(() => { isSnapping.current = false }, 250)
    }
  }

  useEffect(() => {
    if (!('onscrollend' in window)) return
    const rightEl = rightScrollRef.current
    const leftEl = leftScrollRef.current
    if (!rightEl) return
    rightEl.addEventListener('scrollend', snapToRow)
    leftEl?.addEventListener('scrollend', snapToRow)
    return () => {
      rightEl.removeEventListener('scrollend', snapToRow)
      leftEl?.removeEventListener('scrollend', snapToRow)
    }
  }, [])

  function scheduleRowSnap() {
    if ('onscrollend' in window) return // native scrollend listener handles it
    if (snapTimeout.current) clearTimeout(snapTimeout.current)
    snapTimeout.current = setTimeout(snapToRow, 120)
  }

  function handleLeftScroll(e) {
    if (isSnapping.current) return
    if (syncingScroll.current) { syncingScroll.current = false; return }
    const scrollTop = e.currentTarget.scrollTop
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      syncingScroll.current = true
      if (rightScrollRef.current) rightScrollRef.current.scrollTop = scrollTop
    })
    scheduleRowSnap()
  }

  function handleRightScroll(e) {
    if (isSnapping.current) return
    if (syncingScroll.current) { syncingScroll.current = false; return }
    const scrollTop = e.currentTarget.scrollTop
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      syncingScroll.current = true
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = scrollTop
    })
    scheduleRowSnap()
  }

  // Every column header has a filter. Columns with a set of values (Job
  // Description, Crew, Status…) open a tick list; the rest open a condition
  // ("before", "contains", "more than"…).
  async function toggleFilter(fieldKey, e) {
    if (headerFilter?.fieldKey === fieldKey) { setHeaderFilter(null); return }
    const anchorRect = e.currentTarget.getBoundingClientRect()
    const field = filterField(fieldKey)
    if (!field?.list) { setHeaderFilter({ fieldKey, anchorRect }); return }
    setHeaderFilter({ fieldKey, anchorRect, loading: true, options: [] })
    const options = await getOptions(fieldKey).catch(() => [])
    setHeaderFilter(cur => (cur?.fieldKey === fieldKey ? { ...cur, loading: false, options } : cur))
  }

  function headerFilterActive(fieldKey) {
    if (!fieldKey) return false
    return !!filters.values?.[fieldKey]?.length ||
      (filters.rules || []).some(r => r.field === fieldKey && ruleIsComplete(r))
  }

  function applyHeaderValues(fieldKey, picked) {
    const values = { ...(filters.values || {}) }
    if (picked.length) values[fieldKey] = picked
    else delete values[fieldKey]
    setFilters({ ...filters, values })
    setHeaderFilter(null)
  }

  function applyHeaderRule(rule) {
    const rules = [...(filters.rules || [])]
    const i = rules.findIndex(r => r.id === rule.id)
    if (i >= 0) rules[i] = rule
    else rules.push(rule)
    setFilters({ ...filters, rules })
    setHeaderFilter(null)
  }

  function removeHeaderRule(id) {
    setFilters({ ...filters, rules: (filters.rules || []).filter(r => r.id !== id) })
    setHeaderFilter(null)
  }

  // The drawer's dropdowns: the list for this sector, plus the record's own
  // value if it is no longer on the list.
  const opts = field => optionsFor(field, sector, editForm?.[field])

  function openEdit(row) {
    setEditRow(row)
    const f = { ...EMPTY_FORM }
    for (const k of Object.keys(EMPTY_FORM)) f[k] = row[k] ?? EMPTY_FORM[k]
    if (f.status_crew?.toUpperCase().includes('FIELD')) f.status_crew = 'FIELD COMPL.'
    setEditForm(f)
    setSaveError('')
  }

  function closeEdit() { setEditRow(null); setEditForm(null) }

  useEffect(() => {
    if (!editRow) return
    function onKeyDown(e) { if (e.key === 'Escape') closeEdit() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editRow])

  function sf(field, value) { setEditForm(prev => ({ ...prev, [field]: value })) }

  // What actually changed between the record as loaded and the draft an
  // Encoder has been typing into — this, not the whole form, is what goes
  // into the request, so a reviewer sees exactly what they're approving.
  // The baseline is built the same way openEdit built editForm (including
  // the FIELD COMPL. status normalization) so that alone never reads as
  // a change nobody actually made.
  function computeChanges() {
    const baseline = { ...EMPTY_FORM }
    for (const k of Object.keys(EMPTY_FORM)) baseline[k] = editRow[k] ?? EMPTY_FORM[k]
    if (baseline.status_crew?.toUpperCase().includes('FIELD')) baseline.status_crew = 'FIELD COMPL.'

    const changes = {}
    for (const key of Object.keys(EMPTY_FORM)) {
      const oldValue = baseline[key]
      const newValue = editForm[key] ?? EMPTY_FORM[key]
      if (String(oldValue ?? '') !== String(newValue ?? '')) {
        changes[key] = { old: oldValue, new: newValue }
      }
    }
    return changes
  }

  function openRequestEdit() {
    const changes = computeChanges()
    if (Object.keys(changes).length === 0) {
      setSaveError('Change a field before requesting an edit.')
      return
    }
    setSaveError('')
    setPendingChanges(changes)
    setShowEditRequest(true)
  }

  async function handleSave() {

  setSaving(true)
  setSaveError('')


  const payload = {

    ...editForm,

    aging: editForm.aging === ''
      ? null
      : parseInt(editForm.aging),

    billed_amount: editForm.billed_amount === ''
      ? null
      : parseFloat(editForm.billed_amount),

    crew_payrol: editForm.crew_payrol === ''
      ? null
      : parseFloat(editForm.crew_payrol),

    date_assign: editForm.date_assign || null,

    date_executed: editForm.date_executed || null,

    witness_date: editForm.witness_date || null,

    date_returned: editForm.date_returned || null,

  }



  const { error } = await supabase.from(foTable).update(withSubmission(payload, hasSubmission)).eq('id', editRow.id)





  setSaving(false)



  if(error){

    setSaveError(error.message)

  }
  else{

    closeEdit()

    fetchRecords()

  }

}

  async function handleDelete(id) {
    const { error } = await supabase.from(foTable).delete().eq('id', id)
    if (!error) {
      logAudit({
        session, profile, sector,
        action: AUDIT_ACTIONS.RECORD_DELETED,
        targetLabel: deleteTarget?.field_order_no || id,
        targetId: id,
      })
      setDeleteTarget(null)
      fetchRecords()
    }
  }

  async function archiveRecord() {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase
      .from(foTable)
      .update({ archived_at: new Date().toISOString() })
      .eq('id', editRow.id)
    setSaving(false)
    if (error) {
      setSaveError('We could not archive this work order. Please try again.')
      return
    }
    logAudit({
      session, profile, sector,
      action: AUDIT_ACTIONS.RECORD_ARCHIVED,
      targetLabel: editRow.field_order_no,
      targetId: editRow.id,
    })
    closeEdit()
    fetchRecords()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const [exportingSelected, setExportingSelected] = useState(false)

  const EXPORT_FIELDS = [
    { key: 'status_crew',           label: 'Status Crew' },
    { key: 'date_assign',           label: 'Date Assign' },
    { key: 'for_check',             label: 'For Check' },
    { key: 'date_executed',         label: 'For Checking (Date)' },
    { key: 'type_of_meter',         label: 'Type of Meter' },
    { key: 'job_description',       label: 'Job Description' },
    { key: 'crew_name',             label: 'Crew Name' },
    { key: 'location',              label: 'Location' },
    { key: 'service_number',        label: 'Service ID Number' },
    { key: 'submitted_to',          label: 'Submitted To' },
    { key: 'date_submitted',        label: 'Date of Submitted' },
    { key: 'field_order_no',        label: 'Field Order/FO' },
    { key: 'remove_meter',          label: 'Remove Meter' },
    { key: 'r_serial_number',       label: 'R. Serial Number' },
    { key: 'demand_seal_aerolock',  label: 'Demand Seal No.5' },
    { key: 'removed_seal',          label: 'Removed Seal' },
    { key: 'cabinet_seal_remove',   label: 'Cabinet Seal (2)' },
    { key: 'reading_kwh',           label: 'Reading (kWh)' },
    { key: 'demand_kwh_cum',        label: 'DEMAND (kWh)/Cum Demand' },
    { key: 'ins_meter',             label: 'INS. Meter' },
    { key: 'ins_serial_number',     label: 'Serial Number' },
    { key: 'demand_seal_installed', label: 'Demand Seal (5)' },
    { key: 'installed_seal',        label: 'Installed Seal (1)' },
    { key: 'cabinet_seal_installed',label: 'Cabinet Seal (2)' },
    { key: 'tln_tag',               label: 'TLN Tag' },
    { key: 'pole_tag',              label: 'Pole Tag' },
    { key: 'booba_number',          label: 'Booba Number' },
    { key: 'mdltr_no',              label: 'MDLTR No.' },
    { key: 'aging',                 label: 'Aging' },
    { key: 'witness_date',          label: 'Witness Date' },
    { key: 'due_date',              label: 'Due Date (days left)' },
    { key: 'remarks',               label: 'Remarks' },
    { key: 'mflt_checklist',        label: 'MFLT Checklist' },
    { key: 'fo_type',               label: 'FO Type' },
    { key: 'billed_amount',         label: 'Billed Amount' },
    { key: 'for_batch',             label: 'For Batch' },
    { key: 'date_returned',         label: 'Date Returned' },
    { key: 'crew_payrol',           label: 'Crew Payroll' },
    { key: 'percentage',            label: '%' },
    { key: 'pluscode',              label: 'Pluscode' },
    { key: 'plangrid',              label: 'PlanGrid' },
  ]

  async function exportSelected() {
    if (selectedRows.length === 0) return
    setExportingSelected(true)
    const { data, error } = await supabase
      .from(foTable)
      .select('*')
      .in('id', selectedRows)
      .order('seq', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
    setExportingSelected(false)
    if (error || !data || data.length === 0) return
    downloadCsv(data, `field_orders_selected_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // Everything the current search and filters match, not just this page.
  const [exportingFiltered, setExportingFiltered] = useState(false)
  async function exportFiltered() {
    if (total === 0) return
    setExportingFiltered(true)
    const rows = []
    for (let from = 0; ; from += EXPORT_CHUNK) {
      let q = supabase.from(foTable).select('*').is('archived_at', null)
        .order('seq', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + EXPORT_CHUNK - 1)
      q = applyFiltersToQuery(q, effective, { page: 'field_orders', missing })
      const { data, error } = await q
      if (error) { setExportingFiltered(false); setLoadError('The export could not be completed. Please try again.'); return }
      rows.push(...(data || []))
      if (!data || data.length < EXPORT_CHUNK) break
    }
    setExportingFiltered(false)
    if (rows.length) downloadCsv(rows, `field_orders_${hasActiveFilters(effective) ? 'filtered_' : ''}${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function downloadCsv(data, filename) {
    function esc(val) {
      if (val === null || val === undefined) return ''
      const s = String(val)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const header = EXPORT_FIELDS.filter(exportFields).map(f => f.label).join(',')
    // due_date is worked out from witness_date rather than stored, so it
    // has no column to read — every other field comes straight off the row.
    const cell = (row, key) =>
      key === 'due_date' ? (row.for_check ? '' : dueDaysLeft(row)) : row[key]
    const rows = data.map(row => EXPORT_FIELDS.filter(exportFields).map(f => esc(cell(row, f.key))).join(','))
    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function toggleSort(key) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    setSortKey(null)
  }

  function sortArrow(key) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? '▲' : '▼'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }} className="gap-4">
      <style>{`.no-scrollbar{scrollbar-width:none;-ms-overflow-style:none}.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Field Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total.toLocaleString()} total records</p>
        </div>
        <div className="flex items-center gap-3">


</div>
      </div>

      {/* Search, filters, period, saved filters */}
      <FilterBar
        page="field_orders"
        sector={sector}
        filters={filters}
        onChange={setFilters}
        getOptions={getOptions}
        missing={missing}
        disabled={disabled}
        showPeriod
        placeholder="Search FO#, service ID, crew, location, meter, seal, remarks…"
        rightSlot={(
          <button
            type="button"
            onClick={exportFiltered}
            disabled={exportingFiltered || total === 0}
            title="Download every record the search and filters match, as a CSV"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Download size={15} />
            {exportingFiltered ? 'Exporting…' : `Export ${hasActiveFilters(effective) ? 'filtered ' : 'all '}(${total.toLocaleString()})`}
          </button>
        )}
      />

      {loadError && (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
      )}


      {/* Selection Banner */}
      {isAdmin && selectedRows.length > 0 && (
        <div className={`shrink-0 flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${selectAllPages ? 'bg-blue-600' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center gap-3">
            {selectAllPages ? (
              <span className="text-sm font-medium text-white">All {total.toLocaleString()} records are selected.</span>
            ) : (
              <>
                <span className="text-sm text-blue-700">
                  {selectedRows.length} record{selectedRows.length > 1 ? 's' : ''} selected
                  {records.some(r => selectedRows.includes(r.id)) && selectedRows.some(id => !records.map(r => r.id).includes(id)) && (
                    <span className="text-blue-500 ml-1">(across multiple pages)</span>
                  )}
                </span>
                {records.every(r => selectedRows.includes(r.id)) && total > selectedRows.length && (
                  <button
                    onClick={() => setSelectAllPages(true)}
                    className="text-sm text-blue-700 font-semibold underline underline-offset-2 hover:text-blue-900"
                  >
                    Select all {total.toLocaleString()} records
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectAllPages && (
              <button
                onClick={() => { setSelectAllPages(false); setSelectedRows([]) }}
                className="text-xs text-blue-100 hover:text-white underline underline-offset-2"
              >
                Clear selection
              </button>
            )}
            {!selectAllPages && (
              <button
                onClick={exportSelected}
                disabled={exportingSelected}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {exportingSelected ? 'Exporting…' : `Export ${selectedRows.length}`}
              </button>
            )}
            <button
              onClick={archiveSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-slate-600 hover:bg-slate-700 text-white transition-colors"
            >
              <Archive size={14} />
              Archive {(selectAllPages ? total : selectedRows.length).toLocaleString()}
            </button>
            {canDelete && (
            <button
              onClick={deleteSelected}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${selectAllPages ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              Delete {(selectAllPages ? total : selectedRows.length).toLocaleString()} records
            </button>
            )}
          </div>
        </div>
      )}
      {/* Spreadsheet */}
      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex">

          {/* ── Frozen columns: checkbox, #, Status Crew → Service Number. No horizontal scroll here. ── */}
          <div
            ref={leftScrollRef}
            onScroll={handleLeftScroll}
            className="shrink-0 border-r-2 border-slate-300 overflow-y-auto no-scrollbar"
            style={{ overflowX: 'hidden' }}
          >
            <table className="text-xs border-collapse" style={{ width: 'max-content', tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-20">
                <tr style={{ background: '#1e293b', height: 37 }}>
                  {isAdmin && (
                    <th
                      style={{ width: 40, minWidth: 40, background: '#1e293b' }}
                      className="px-2 py-2.5 text-center font-medium text-slate-300 border-r border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={
                          records.length > 0 &&
                          records.every(r => selectedRows.includes(r.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(prev => {
                              const newIds = records.map(r => r.id).filter(id => !prev.includes(id))
                              return [...prev, ...newIds]
                            })
                          } else {
                            setSelectedRows(prev => prev.filter(id => !records.map(r => r.id).includes(id)))
                          }
                        }}
                      />
                    </th>
                  )}
                  <th
                    style={{ width: 40, minWidth: 40, background: '#1e293b' }}
                    className="px-2 py-2.5 text-center font-medium text-slate-400 border-r border-slate-700"
                  >
                    #
                  </th>
                  {FROZEN_COLS.map(col => {
                    const hk = headerFilterKey(col.key)
                    const filterKey = hk && !hidden.includes(hk) ? hk : null
                    const isActive = headerFilterActive(filterKey)
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.w, maxWidth: col.w, background: '#1e293b' }}
                        className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap border-r border-slate-700 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); toggleSort(col.key) }}
                            className="flex min-w-0 flex-1 items-center gap-1 text-left transition-colors hover:text-white"
                            title={`Sort by ${col.label}`}
                          >
                            <span className="truncate">{col.label}</span>
                            <span className="shrink-0 text-blue-400" style={{ fontSize: 8, lineHeight: 1 }}>
                              {sortArrow(col.key)}
                            </span>
                          </button>
                          {filterKey && (
                            <button
                              data-filter-anchor
                              title={`Filter ${col.label}`}
                              onClick={e => { e.stopPropagation(); toggleFilter(filterKey, e) }}
                              className={`shrink-0 rounded px-0.5 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                              style={{ fontSize: 9, lineHeight: 1 }}
                            >
                              {isActive ? '▼' : '▽'}
                            </button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={FROZEN_COLS.length + (isAdmin ? 2 : 1)} className="px-4 py-16 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={FROZEN_COLS.length + (isAdmin ? 2 : 1)} className="px-4 py-16 text-center text-slate-400">{hasActiveFilters(effective) ? 'No records match these filters.' : 'No records found.'}</td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const sel = editRow?.id === row.id
                    const overdue = !row.for_check && agingLevel(row) === 'critical'
                    // Frozen section is tinted so it reads as its own block,
                    // distinct from the scrollable columns to its right.
                    const rowBg = sel ? '#eff6ff' : overdue ? '#fef2f2' : (hoverRowId === row.id ? '#e2e8f0' : '#f1f5f9')
                    return (
                      <tr
                        key={row.id}
                        onClick={() => sel ? closeEdit() : openEdit(row)}
                        onMouseEnter={() => setHoverRowId(row.id)}
                        onMouseLeave={() => setHoverRowId(null)}
                        style={{ background: rowBg, height: 33 }}
                        className={`cursor-pointer border-b border-slate-100 transition-colors ${sel ? 'outline outline-2 outline-blue-400 outline-offset-[-2px]' : ''}`}
                      >
                        {isAdmin && (
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRows.includes(row.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleRow(row.id)}
                            />
                          </td>
                        )}
                        <td
                          style={{ width: 40, minWidth: 40 }}
                          className="px-2 py-2 text-center text-slate-400 border-r border-slate-100"
                        >
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        {FROZEN_COLS.map(col => (
                          <td
                            key={col.key}
                            style={{ minWidth: col.w, maxWidth: col.w }}
                            className={`px-3 py-2 border-r border-slate-100 last:border-0 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis${col.mono ? ' font-mono' : ''}`}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Scrollable columns: Remove Meter onward. Horizontal scroll starts here. ── */}
          <div
            ref={rightScrollRef}
            onScroll={handleRightScroll}
            className="flex-1 min-w-0 overflow-auto"
          >
            <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%', tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-20">
                <tr style={{ background: '#1e293b', height: 37 }}>
                  {scrollCols.map(col => {
                    const hk = headerFilterKey(col.key)
                    const filterKey = hk && !hidden.includes(hk) ? hk : null
                    const isActive = headerFilterActive(filterKey)
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.w, maxWidth: col.w, background: '#1e293b' }}
                        className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap border-r border-slate-700 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); toggleSort(col.key) }}
                            className="flex min-w-0 flex-1 items-center gap-1 text-left transition-colors hover:text-white"
                            title={`Sort by ${col.label}`}
                          >
                            <span className="truncate">{col.label}</span>
                            <span className="shrink-0 text-blue-400" style={{ fontSize: 8, lineHeight: 1 }}>
                              {sortArrow(col.key)}
                            </span>
                          </button>
                          {filterKey && (
                            <button
                              data-filter-anchor
                              title={`Filter ${col.label}`}
                              onClick={e => { e.stopPropagation(); toggleFilter(filterKey, e) }}
                              className={`shrink-0 rounded px-0.5 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                              style={{ fontSize: 9, lineHeight: 1 }}
                            >
                              {isActive ? '▼' : '▽'}
                            </button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={scrollCols.length} className="px-4 py-16 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={scrollCols.length} className="px-4 py-16 text-center text-slate-400">{hasActiveFilters(effective) ? 'No records match these filters.' : 'No records found.'}</td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const sel = editRow?.id === row.id
                    const overdue = !row.for_check && agingLevel(row) === 'critical'
                    const rowBg = sel ? '#eff6ff' : overdue ? '#fef2f2' : (hoverRowId === row.id ? '#f8fafc' : '#ffffff')
                    return (
                      <tr
                        key={row.id}
                        onClick={() => sel ? closeEdit() : openEdit(row)}
                        onMouseEnter={() => setHoverRowId(row.id)}
                        onMouseLeave={() => setHoverRowId(null)}
                        style={{ background: rowBg, height: 33 }}
                        className={`cursor-pointer border-b border-slate-100 transition-colors ${sel ? 'outline outline-2 outline-blue-400 outline-offset-[-2px]' : ''}`}
                      >
                        {scrollCols.map(col => (
                          <td
                            key={col.key}
                            style={{ minWidth: col.w, maxWidth: col.w }}
                            className={`px-3 py-2 border-r border-slate-100 last:border-0 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis${col.mono ? ' font-mono' : ''}`}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Pagination */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-sm text-slate-500">
          <p>Showing {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} records • Click a row to edit</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs flex items-center gap-1">
                Page
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page + 1}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1 && v <= totalPages) setPage(v - 1)
                  }}
                  className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                of {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editRow && editForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeEdit} />
          {/* pointer-events-none lets clicks outside the card fall through to
              the backdrop above, which closes the modal. */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Editing Record</p>
                <h2 className="font-mono font-bold text-slate-800 text-lg">{editRow.field_order_no || `ID #${editRow.id}`}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <button
                      onClick={archiveRecord}
                      disabled={saving}
                      className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Archive size={14} />
                      Archive
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Save size={14} />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </>
                )}
                {/* Field Orders feeds another system on a daily automatic
                    pull, so an Encoder's changes go to an Admin/Super Admin
                    for review instead of writing straight to the table. */}
                {canRequestEdit && (
                  <button
                    onClick={openRequestEdit}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Send size={14} />
                    Request Edit
                  </button>
                )}
                <button onClick={closeEdit} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {saveError && (
              <div className="mx-5 mt-3 shrink-0 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{saveError}</div>
            )}

            {/* Drawer Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">

              {/* A greyed-out form with no explanation reads as broken, so
                  say why it is locked and where a correction does go. */}
              {isAdmin && (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <p>
                    This record is already in Field Orders, so only <strong>Status Crew</strong>,{' '}
                    <strong>For Check</strong> and <strong>For Batch</strong> can still be changed here.
                    Anything else has to come through an edit request.
                  </p>
                </div>
              )}

              <fieldset disabled={!isAdmin && !canRequestEdit} className="space-y-6 border-0 p-0 m-0 min-w-0">

              <PS title="Main Information">
                <PF label="Field Order No.">
                  <input value={editForm.field_order_no} onChange={e => sf('field_order_no', e.target.value)} disabled={fieldLocked('field_order_no')} className={iCls} />
                </PF>
                <PF label="Service ID Number">
                  <input value={editForm.service_number} onChange={e => sf('service_number', e.target.value)} disabled={fieldLocked('service_number')} className={iCls} />
                </PF>
                <PF label="Status Crew">
                  <select value={editForm.status_crew} onChange={e => sf('status_crew', e.target.value)} disabled={fieldLocked('status_crew')} className={iCls}>
                    <option value="">— Select —</option>
                    <option>FOR ASSIGN</option>
                    <option>ASSIGNED</option>
                    <option>RE-ASSIGN</option>
                    <option>FIELD COMPL.</option>
                    <option>CANCEL</option>
                    <option>CANCEL-EMC</option>
                    <option>FC CANCEL</option>
                    <option>REVISITED FIELD COM.</option>
                    <option>REVISITED CANCEL</option>
                  </select>
                </PF>
                <PF label="Date Assign">
                  <input type="date" value={editForm.date_assign} onChange={e => sf('date_assign', e.target.value)} disabled={fieldLocked('date_assign')} className={iCls} />
                </PF>
                <PF label="Date Executed">
                  <input type="date" value={editForm.date_executed} onChange={e => sf('date_executed', e.target.value)} disabled={fieldLocked('date_executed')} className={iCls} />
                </PF>
                <PF label="Type of Meter">
                  <select value={editForm.type_of_meter} onChange={e => sf('type_of_meter', e.target.value)} disabled={fieldLocked('type_of_meter')} className={iCls}>
                    <option value="">— Select —</option>
                    {opts('type_of_meter').map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Job Description">
                  <select value={editForm.job_description} onChange={e => sf('job_description', e.target.value)} disabled={fieldLocked('job_description')} className={iCls}>
                    <option value="">— Select —</option>
                    {opts('job_description').map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Crew Name">
  <input
    value={editForm.crew_name}
    onChange={e => {
    const crew = e.target.value

    setEditForm(prev => {
        let newStatus = prev.status_crew

        if (crew.trim() === '') {
            newStatus = 'FOR ASSIGN'
        } else if (
            prev.crew_name &&
            prev.crew_name.trim() !== '' &&
            prev.crew_name !== crew
        ) {
            newStatus = 'RE-ASSIGN'
        } else {
            newStatus = 'ASSIGNED'
        }

        return {
            ...prev,
            crew_name: crew,
            status_crew: newStatus
        }
    })
}}
    className={iCls}
    placeholder="Enter crew name"
  />
</PF>
                <PF label="Location" span2>
                  <input value={editForm.location} onChange={e => sf('location', e.target.value)} disabled={fieldLocked('location')} className={iCls} />
                </PF>
                <PF label="For Check">
                  <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                    <input type="checkbox" checked={!!editForm.for_check} onChange={e => sf('for_check', e.target.checked)} disabled={fieldLocked('for_check')} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-600">Checked</span>
                  </label>
                </PF>
                <PF label="For Batch">
                  <select value={editForm.for_batch} onChange={e => sf('for_batch', e.target.value)} disabled={fieldLocked('for_batch')} className={iCls}>
                    <option value="">— Select —</option>
                    {opts('for_batch').map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                {hasSubmission && (
                  <>
                    <PF label="Submitted To">
                      <input
                        value={editForm.submitted_to ?? ''}
                        onChange={e => sf('submitted_to', e.target.value)}
                        disabled={fieldLocked('submitted_to')}
                        list="submitted-to-options"
                        className={iCls}
                      />
                      <datalist id="submitted-to-options">
                        {optionsFor('submitted_to', sector).map(o => <option key={o} value={o} />)}
                      </datalist>
                    </PF>
                    <PF label="Date of Submitted">
                      <input type="date" value={editForm.date_submitted ?? ''} onChange={e => sf('date_submitted', e.target.value)} disabled={fieldLocked('date_submitted')} className={iCls} />
                    </PF>
                  </>
                )}
              </PS>

              <PS title="Remove Meter">
                <PF label="Remove Meter No.">
                  <input value={editForm.remove_meter} onChange={e => sf('remove_meter', e.target.value)} disabled={fieldLocked('remove_meter')} className={iCls} />
                </PF>
                <PF label="R. Serial Number">
                  <input value={editForm.r_serial_number} onChange={e => sf('r_serial_number', e.target.value)} disabled={fieldLocked('r_serial_number')} className={iCls} />
                </PF>
                <PF label="Demand Seal Aerolock">
                  <input value={editForm.demand_seal_aerolock} onChange={e => sf('demand_seal_aerolock', e.target.value)} disabled={fieldLocked('demand_seal_aerolock')} className={iCls} />
                </PF>
                <PF label="Removed Seal">
                  <input value={editForm.removed_seal} onChange={e => sf('removed_seal', e.target.value)} disabled={fieldLocked('removed_seal')} className={iCls} />
                </PF>
                <PF label="Cabinet Seal (Remove)">
                  <input value={editForm.cabinet_seal_remove} onChange={e => sf('cabinet_seal_remove', e.target.value)} disabled={fieldLocked('cabinet_seal_remove')} className={iCls} />
                </PF>
                <PF label="Reading (kWh)">
                  <input value={editForm.reading_kwh} onChange={e => sf('reading_kwh', e.target.value)} disabled={fieldLocked('reading_kwh')} className={iCls} />
                </PF>
                <PF label="DEMAND (kWh)/Cum Demand">
                  <input value={editForm.demand_kwh_cum} onChange={e => sf('demand_kwh_cum', e.target.value)} disabled={fieldLocked('demand_kwh_cum')} className={iCls} />
                </PF>
                {/* Normal removal vs Meter For Lab Test. Booba number and
                    witnessing date apply only to an MFLT. */}
                <PF label="Removed Meter Type" span2>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!editForm.mflt_checklist}
                      onChange={e => {
                        const on = e.target.checked
                        sf('mflt_checklist', on)
                        if (!on) { sf('booba_number', ''); sf('witness_date', '') }
                      }}
                      disabled={fieldLocked('mflt_checklist')}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">MFLT — Meter For Lab Test</span>
                  </label>
                </PF>
                <PF label="Booba Number">
                  <input
                    value={editForm.booba_number}
                    onChange={e => sf('booba_number', e.target.value)}
                    disabled={fieldLocked('booba_number') || (!editForm.mflt_checklist)}
                    placeholder={editForm.mflt_checklist ? '' : 'MFLT only'}
                    className={`${iCls} disabled:bg-slate-100 disabled:text-slate-400`}
                  />
                </PF>
                <PF label="Witnessing Date">
                  <input
                    type="date"
                    value={editForm.witness_date}
                    onChange={e => sf('witness_date', e.target.value)}
                    disabled={fieldLocked('witness_date') || (!editForm.mflt_checklist)}
                    className={`${iCls} disabled:bg-slate-100 disabled:text-slate-400`}
                  />
                </PF>
              </PS>

              <PS title="New Installed Meter">
                <PF label="Installed Meter No.">
                  <input value={editForm.ins_meter} onChange={e => sf('ins_meter', e.target.value)} disabled={fieldLocked('ins_meter')} className={iCls} />
                </PF>
                <PF label="Serial Number">
                  <input value={editForm.ins_serial_number} onChange={e => sf('ins_serial_number', e.target.value)} disabled={fieldLocked('ins_serial_number')} className={iCls} />
                </PF>
                <PF label="Demand Seal (5)">
                  <input value={editForm.demand_seal_installed} onChange={e => sf('demand_seal_installed', e.target.value)} disabled={fieldLocked('demand_seal_installed')} className={iCls} />
                </PF>
                <PF label="Installed Seal (1)">
                  <input value={editForm.installed_seal} onChange={e => sf('installed_seal', e.target.value)} disabled={fieldLocked('installed_seal')} className={iCls} />
                </PF>
                <PF label="Cabinet Seal (2)">
                  <input value={editForm.cabinet_seal_installed} onChange={e => sf('cabinet_seal_installed', e.target.value)} disabled={fieldLocked('cabinet_seal_installed')} className={iCls} />
                </PF>
                <PF label="TLN Tag">
                  <input value={editForm.tln_tag} onChange={e => sf('tln_tag', e.target.value)} disabled={fieldLocked('tln_tag')} className={iCls} />
                </PF>
                <PF label="Pole Tag">
                  <input value={editForm.pole_tag} onChange={e => sf('pole_tag', e.target.value)} disabled={fieldLocked('pole_tag')} className={iCls} />
                </PF>
                <PF label="MDLTR No.">
                  <input value={editForm.mdltr_no} onChange={e => sf('mdltr_no', e.target.value)} disabled={fieldLocked('mdltr_no')} className={iCls} />
                </PF>
                <PF label="Aging (days)">
                  <input type="number" value={editForm.aging} onChange={e => sf('aging', e.target.value)} disabled={fieldLocked('aging')} className={iCls} />
                </PF>
              </PS>

              <PS title="Remarks & Batch">
                <PF label="FO Type">
                  <select value={editForm.fo_type} onChange={e => sf('fo_type', e.target.value)} disabled={fieldLocked('fo_type')} className={iCls}>
                    <option value="">— Select —</option>
                    {opts('fo_type').map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Billed Amount (₱)">
                  <select value={editForm.billed_amount} onChange={e => sf('billed_amount', e.target.value)} disabled={fieldLocked('billed_amount')} className={iCls}>
                    <option value="">— Select —</option>
                    {opts('billed_amount').map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="Date Returned">
                  <input type="date" value={editForm.date_returned} onChange={e => sf('date_returned', e.target.value)} disabled={fieldLocked('date_returned')} className={iCls} />
                </PF>
                <PF label="Crew Payrol (₱)">
                  <input type="number" step="0.01" value={editForm.crew_payrol} onChange={e => sf('crew_payrol', e.target.value)} disabled={fieldLocked('crew_payrol')} className={iCls} />
                </PF>
                <PF label="Percentage (%)">
                  <input value={editForm.percentage} onChange={e => sf('percentage', e.target.value)} disabled={fieldLocked('percentage')} className={iCls} />
                </PF>
                <PF label="Plus Code">
                  <input value={editForm.pluscode} onChange={e => sf('pluscode', e.target.value)} disabled={fieldLocked('pluscode')} className={iCls} />
                </PF>
                <PF label="PlanGrid">
                  <input value={editForm.plangrid} onChange={e => sf('plangrid', e.target.value)} disabled={fieldLocked('plangrid')} className={iCls} />
                </PF>
                <PF label="Remarks" span2>
  <textarea
    value={editForm.remarks}
    onChange={e => sf('remarks', e.target.value)}
    disabled={fieldLocked('remarks')}
    rows={3}
    maxLength={100}
    className={`${iCls} resize-none`}
  />

  <p className="text-xs text-gray-500 mt-1">
    {(editForm.remarks || '').length}/100
  </p>
</PF>
              </PS>

              </fieldset>

              <div className="pt-1 border-t border-slate-100">
                {canDelete ? (
                  <button
                    onClick={() => { closeEdit(); setDeleteTarget(editRow) }}
                    className="w-full px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                  >
                    Delete this record
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDeletionRequest(true)}
                    className="w-full px-4 py-2 border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-sm font-medium"
                  >
                    Request Deletion
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {showDeletionRequest && editRow && (
        <RequestDeletionModal
          record={editRow}
          onClose={() => setShowDeletionRequest(false)}
          onSubmitted={() => { setShowDeletionRequest(false); closeEdit() }}
        />
      )}

      {showEditRequest && editRow && pendingChanges && (
        <RequestEditModal
          record={editRow}
          changes={pendingChanges}
          onClose={() => setShowEditRequest(false)}
          onSubmitted={() => { setShowEditRequest(false); setPendingChanges(null); closeEdit() }}
        />
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-slate-800 text-lg">Are you sure?</h3>
            <p className="text-slate-500 text-sm mt-2">{confirm.message}</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={confirm.onConfirm}
                className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${confirm.tone === 'archive' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirm.confirmLabel || 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-slate-800 text-lg">Delete Record?</h3>
            <p className="text-slate-500 text-sm mt-2">
              Field order <span className="font-mono font-semibold text-slate-700">{deleteTarget.field_order_no || deleteTarget.id}</span> will be permanently deleted.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget.id)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Column header filter */}
      {headerFilter && (() => {
        const field = filterField(headerFilter.fieldKey)
        if (!field) return null
        const close = () => setHeaderFilter(null)
        if (field.list) {
          return (
            <FloatingPanel anchorRect={headerFilter.anchorRect} onClose={close} width={280}>
              <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
              <ValuePicker
                key={field.key}
                options={headerFilter.options}
                loading={headerFilter.loading}
                selected={filters.values?.[field.key] || []}
                onApply={picked => applyHeaderValues(field.key, picked)}
                onCancel={close}
              />
            </FloatingPanel>
          )
        }
        const existing = (filters.rules || []).find(r => r.field === field.key)
        const rule = existing || { id: `col:${field.key}`, field: field.key, op: '' }
        return (
          <FloatingPanel anchorRect={headerFilter.anchorRect} onClose={close} width={300}>
            <RuleEditor
              key={rule.id}
              rule={rule}
              onApply={applyHeaderRule}
              onCancel={close}
              onRemove={existing ? () => removeHeaderRule(existing.id) : undefined}
            />
          </FloatingPanel>
        )
      })()}
    </div>
  )
}