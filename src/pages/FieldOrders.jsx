import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronLeft, ChevronRight, X, Save, Download, Upload, Archive } from 'lucide-react'
import ImportModal from '../components/ImportModal'
import RequestDeletionModal from '../components/RequestDeletionModal'
import { useAuth } from '../lib/AuthContext'
import { computeAgingDays, isOverdue } from '../lib/aging'

const PAGE_SIZE = 50

const STATUS_OPTIONS = ['All', 'RE-ASSIGN','FOR ASSIGN', 'ASSIGNED', 'CANCEL', 'CANCEL-EMC', 'FC CANCEL', 'FIELD COMPLETED', 'REVISITED FIELD COM.', 'REVISITED CANCEL']
const TYPE_OF_METER_OPTIONS = ['All', '12S', '12S ID METER', '1S', '1S EMC L-G', '25S', '2S EMC L-G', '2S EMC L-L', '2S EMX', '2S ID', '2S ID METER', '2S ID METER/ERC', '2S PLAIN METER', '9S', 'EMX', 'ERC 2S PLAIN METER', 'FOR REPLACE', 'KLOAD', 'RETURNED']
const JOB_DESCRIPTION_OPTIONS = ['All', 'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX', 'RETIRE', 'RETIRE-EMC', 'RETIRE-EMC-WIRE']
const CREW_NAME_OPTIONS = ['All', 'A. TOMADA', 'B. VERDARERO', 'C. BENIGNO', 'D. FABOL', 'E. VILLAREAL', 'J. BITAGO', 'J. J. SERRANO']
const FO_TYPE_OPTIONS = ['All', 'CANCEL', 'CANCEL-EMC', 'CUT SERVICE ENTRANCE', 'ENERGIZED', 'REMOVE', 'REMOVE-EMC', 'REMOVE-EMC-WIRE', 'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX']
const BILLED_AMOUNT_OPTIONS = ['All', '0', '172.45', '253.43', '344.9', '383.22', '574.83', '766.44', '958.05', '1013.71', '1689.61']
const BATCH_OPTIONS = ['All', 'ALREADY BATCH', 'FOR BATCH', 'MISSING METER', 'OTHERS PENDING']

const EMPTY_FORM = {
  status_crew: 'FOR ASSIGN', date_assign: '', for_check: false, date_executed: '', type_of_meter: '',
  job_description: '', crew_name: '', location: '', service_number: '', field_order_no: '',
  remove_meter: '', r_serial_number: '', demand_seal_aerolock: '', removed_seal: '',
  cabinet_seal_remove: '', reading_kwh: '', demand_kwh_cum: '', ins_meter: '', ins_serial_number: '',
  demand_seal_installed: '', installed_seal: '', cabinet_seal_installed: '', tln_tag: '',
  pole_tag: '', booba_number: '', mdltr_no: '', aging: '', witness_date: '', remarks: '',
  mflt_checklist: false, fo_type: '', billed_amount: '', for_batch: '', date_returned: '',
  crew_payrol: '', percentage: '', pluscode: '',
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
  { label: 'STATUS CREW',         key: 'status_crew',           w: 120, render: r => <StatusBadge status={r.status_crew} /> },
  { label: 'DATE ASSIGN',         key: 'date_assign',           w: 105, render: r => r.date_assign || '—' },
  { label: 'FOR CHECK',           key: 'for_check',             w: 80,  render: r => r.for_check ? <span className="text-emerald-600 font-bold">✓</span> : '' },
  { label: 'DATE EXECUTED',       key: 'date_executed',         w: 140, render: r => r.date_executed || '—' },
  { label: 'TYPE OF METER',       key: 'type_of_meter',         w: 130, render: r => r.type_of_meter || '—' },
  { label: 'JOB DESCRIPTION',     key: 'job_description',       w: 120, render: r => r.job_description || '—' },
  { label: 'CREW NAME',           key: 'crew_name',             w: 130, render: r => r.crew_name || '—' },
  { label: 'FIELD ORDER/FO',      key: 'field_order_no',        w: 145, mono: true, render: r => r.field_order_no || '—' },
  { label: 'SERVICE ID NUMBER',      key: 'service_number',        w: 135, render: r => r.service_number || '—' },
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
      const days = computeAgingDays(r.date_executed)
      if (days == null) return '—'
      return <span className={isOverdue(r) ? 'text-red-600 font-bold' : ''}>{days}</span>
    }
  },
  { label: 'WITNESS DATE',        key: 'witness_date',          w: 115, render: r => r.witness_date || '—' },
  { label: 'REMARKS',             key: 'remarks',               w: 200, render: r => r.remarks || '—' },
  { label: 'LOCATION',            key: 'location',              w: 260, render: r => r.location || '—' },
  { label: 'MFLT CHECKLIST',      key: 'mflt_checklist',        w: 110, render: r => r.mflt_checklist ? <span className="text-emerald-600 font-bold">✓</span> : '' },
  { label: 'FO TYPE',             key: 'fo_type',               w: 90,  render: r => <FoTypeBadge type={r.fo_type} /> },
  { label: 'BILLED AMOUNT',       key: 'billed_amount',         w: 110, render: r => r.billed_amount != null ? `₱${parseFloat(r.billed_amount).toFixed(2)}` : '—' },
  { label: 'FOR BATCH',           key: 'for_batch',             w: 100, render: r => r.for_batch?.toUpperCase().includes('ALREADY') ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">Batched</span> : <span className="text-slate-300">—</span> },
  { label: 'DATE RETURNED',       key: 'date_returned',         w: 115, render: r => r.date_returned || '—' },
  { label: 'CREW PAYROLL',        key: 'crew_payrol',           w: 110, render: r => r.crew_payrol != null ? `₱${r.crew_payrol}` : '—' },
  { label: 'PLUSCODE',            key: 'pluscode',              w: 90,  render: r => r.pluscode || '—' },
]

// Columns pinned to the left (Status Crew → Service Number). Everything after
// this stays in its own horizontally-scrollable table starting at Remove Meter.
const FROZEN_COL_COUNT = 9
const FROZEN_COLS = COLS.slice(0, FROZEN_COL_COUNT)
const SCROLL_COLS = COLS.slice(FROZEN_COL_COUNT)

export default function FieldOrders() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [showDeletionRequest, setShowDeletionRequest] = useState(false)
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeOfMeterFilter, setTypeOfMeterFilter] = useState('All')
  const [jobDescriptionFilter, setJobDescriptionFilter] = useState('All')
  const [crewNameFilter, setCrewNameFilter] = useState('All')
  const [foTypeFilter, setFoTypeFilter] = useState('All')
  const [billedAmountFilter, setBilledAmountFilter] = useState('All')
  const [batchFilter, setBatchFilter] = useState('All')
  const [dateExecutedFilter, setDateExecutedFilter] = useState('')
  const [dateAssignFilter, setDateAssignFilter] = useState('')
  const [openFilterKey, setOpenFilterKey] = useState(null)
  const [filterPos, setFilterPos] = useState({ x: 0, y: 0 })
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
  const [repeatCount,setRepeatCount] = useState(1)

function deleteSelected() {
  const count = selectAllPages ? total : selectedRows.length
  setConfirm({
    message: `Delete ${count.toLocaleString()} record${count > 1 ? 's' : ''}? This cannot be undone.`,
    onConfirm: async () => {
      if (selectAllPages) {
        let q = supabase.from('field_orders').delete().is('archived_at', null)
        const hasFilters = search || statusFilter !== 'All' || typeOfMeterFilter !== 'All' || jobDescriptionFilter !== 'All' || crewNameFilter !== 'All' || foTypeFilter !== 'All' || billedAmountFilter !== 'All' || batchFilter !== 'All' || dateExecutedFilter || dateAssignFilter
        if (!hasFilters) {
          q = q.neq('id', '00000000-0000-0000-0000-000000000000')
        } else {
          if (search) q = q.or(`field_order_no.ilike.%${search}%,service_number.ilike.%${search}%,crew_name.ilike.%${search}%,location.ilike.%${search}%,remove_meter.ilike.%${search}%,ins_meter.ilike.%${search}%`)
          if (statusFilter !== 'All') q = statusFilter === 'FIELD COMPLETED' ? q.ilike('status_crew', '%FIELD%') : q.ilike('status_crew', statusFilter)
          if (typeOfMeterFilter !== 'All') q = q.ilike('type_of_meter', typeOfMeterFilter)
          if (jobDescriptionFilter !== 'All') q = q.ilike('job_description', jobDescriptionFilter)
          if (crewNameFilter !== 'All') q = q.ilike('crew_name', crewNameFilter)
          if (foTypeFilter !== 'All') q = q.ilike('fo_type', foTypeFilter)
          if (billedAmountFilter !== 'All') q = q.eq('billed_amount', parseFloat(billedAmountFilter))
          if (batchFilter !== 'All') q = q.ilike('for_batch', batchFilter)
          if (dateExecutedFilter) q = q.eq('date_executed', dateExecutedFilter)
          if (dateAssignFilter) q = q.eq('date_assign', dateAssignFilter)
        }
        await q
      } else {
        await supabase.from('field_orders').delete().in('id', selectedRows)
      }
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
        let q = supabase.from('field_orders').update({ archived_at: new Date().toISOString() }).is('archived_at', null)
        const hasFilters = search || statusFilter !== 'All' || typeOfMeterFilter !== 'All' || jobDescriptionFilter !== 'All' || crewNameFilter !== 'All' || foTypeFilter !== 'All' || billedAmountFilter !== 'All' || batchFilter !== 'All' || dateExecutedFilter || dateAssignFilter
        if (!hasFilters) {
          q = q.neq('id', '00000000-0000-0000-0000-000000000000')
        } else {
          if (search) q = q.or(`field_order_no.ilike.%${search}%,service_number.ilike.%${search}%,crew_name.ilike.%${search}%,location.ilike.%${search}%,remove_meter.ilike.%${search}%,ins_meter.ilike.%${search}%`)
          if (statusFilter !== 'All') q = statusFilter === 'FIELD COMPLETED' ? q.ilike('status_crew', '%FIELD%') : q.ilike('status_crew', statusFilter)
          if (typeOfMeterFilter !== 'All') q = q.ilike('type_of_meter', typeOfMeterFilter)
          if (jobDescriptionFilter !== 'All') q = q.ilike('job_description', jobDescriptionFilter)
          if (crewNameFilter !== 'All') q = q.ilike('crew_name', crewNameFilter)
          if (foTypeFilter !== 'All') q = q.ilike('fo_type', foTypeFilter)
          if (billedAmountFilter !== 'All') q = q.eq('billed_amount', parseFloat(billedAmountFilter))
          if (batchFilter !== 'All') q = q.ilike('for_batch', batchFilter)
          if (dateExecutedFilter) q = q.eq('date_executed', dateExecutedFilter)
          if (dateAssignFilter) q = q.eq('date_assign', dateAssignFilter)
        }
        await q
      } else {
        await supabase.from('field_orders').update({ archived_at: new Date().toISOString() }).in('id', selectedRows)
      }
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
      .from('field_orders')
      .select('*', { count: 'exact' })
      .is('archived_at', null)
      .order('seq', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search) {
      q = q.or(
        `field_order_no.ilike.%${search}%,service_number.ilike.%${search}%,crew_name.ilike.%${search}%,location.ilike.%${search}%,remove_meter.ilike.%${search}%,ins_meter.ilike.%${search}%`
      )
    }
    if (statusFilter !== 'All') {
      q = statusFilter === 'FIELD COMPLETED' ? q.ilike('status_crew', '%FIELD%') : q.ilike('status_crew', statusFilter)
    }
    if (typeOfMeterFilter !== 'All') q = q.ilike('type_of_meter', typeOfMeterFilter)
    if (jobDescriptionFilter !== 'All') q = q.ilike('job_description', jobDescriptionFilter)
    if (crewNameFilter !== 'All') q = q.ilike('crew_name', crewNameFilter)
    if (foTypeFilter !== 'All') q = q.ilike('fo_type', foTypeFilter)
    if (billedAmountFilter !== 'All') q = q.eq('billed_amount', parseFloat(billedAmountFilter))
    if (batchFilter !== 'All') q = q.ilike('for_batch', batchFilter)
    if (dateExecutedFilter) q = q.eq('date_executed', dateExecutedFilter)
    if (dateAssignFilter) q = q.eq('date_assign', dateAssignFilter)

    const { data, count, error } = await q
    if (!error) { setRecords(data); setTotal(count) }
    setLoading(false)
  }, [page, search, statusFilter, typeOfMeterFilter, jobDescriptionFilter, crewNameFilter, foTypeFilter, billedAmountFilter, batchFilter, dateExecutedFilter, dateAssignFilter])

useEffect(() => { 
  fetchRecords() 
}, [fetchRecords])


useEffect(() => {
  setPage(0)
  setSelectAllPages(false)
  setSelectedRows([])
}, [search, statusFilter, typeOfMeterFilter, jobDescriptionFilter, crewNameFilter, foTypeFilter, billedAmountFilter, batchFilter, dateExecutedFilter,  dateAssignFilter])


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

  function toggleFilter(key, e) {
    if (openFilterKey === key) { setOpenFilterKey(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setFilterPos({ x: rect.left, y: rect.bottom + 4 })
    setOpenFilterKey(key)
  }

  useEffect(() => {
    if (!openFilterKey) return
    function handler(e) {
      if (!e.target.closest('[data-filter-dropdown]')) setOpenFilterKey(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openFilterKey])

  function openEdit(row) {
    setEditRow(row)
    const f = { ...EMPTY_FORM }
    for (const k of Object.keys(EMPTY_FORM)) f[k] = row[k] ?? EMPTY_FORM[k]
    if (f.status_crew?.toUpperCase().includes('FIELD')) f.status_crew = 'FIELD COMPL.'
    setEditForm(f)
    setSaveError('')
  }

  function closeEdit() { setEditRow(null); setEditForm(null) }

  function sf(field, value) { setEditForm(prev => ({ ...prev, [field]: value })) }

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



  const { error } = await supabase.from('field_orders').update(payload).eq('id', editRow.id)





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
    const { error } = await supabase.from('field_orders').delete().eq('id', id)
    if (!error) { setDeleteTarget(null); fetchRecords() }
  }

  async function archiveRecord() {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase
      .from('field_orders')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', editRow.id)
    setSaving(false)
    if (error) {
      setSaveError('We could not archive this work order. Please try again.')
      return
    }
    closeEdit()
    fetchRecords()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const [exportingSelected, setExportingSelected] = useState(false)
  const [showImport, setShowImport] = useState(false)

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
    { key: 'remarks',               label: 'Remarks' },
    { key: 'mflt_checklist',        label: 'MFLT Checklist' },
    { key: 'fo_type',               label: 'FO Type' },
    { key: 'billed_amount',         label: 'Billed Amount' },
    { key: 'for_batch',             label: 'For Batch' },
    { key: 'date_returned',         label: 'Date Returned' },
    { key: 'crew_payrol',           label: 'Crew Payroll' },
    { key: 'percentage',            label: '%' },
    { key: 'pluscode',              label: 'Pluscode' },
  ]

  async function exportSelected() {
    if (selectedRows.length === 0) return
    setExportingSelected(true)
    const { data, error } = await supabase
      .from('field_orders')
      .select('*')
      .in('id', selectedRows)
      .order('seq', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
    setExportingSelected(false)
    if (error || !data || data.length === 0) return

    function esc(val) {
      if (val === null || val === undefined) return ''
      const s = String(val)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const header = EXPORT_FIELDS.map(f => f.label).join(',')
    const rows = data.map(row => EXPORT_FIELDS.map(f => esc(row[f.key])).join(','))
    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `field_orders_selected_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const COL_FILTER_KEYS = {
    status_crew:    { options: STATUS_OPTIONS,        value: statusFilter,        set: setStatusFilter,        isActive: () => statusFilter !== 'All' },
    date_assign: { type: 'date', value: dateAssignFilter, set: setDateAssignFilter, isActive: () => !!dateAssignFilter,},
    date_executed:  { type: 'date',                   value: dateExecutedFilter,  set: setDateExecutedFilter,  isActive: () => !!dateExecutedFilter },
    type_of_meter:  { options: TYPE_OF_METER_OPTIONS, value: typeOfMeterFilter,   set: setTypeOfMeterFilter,   isActive: () => typeOfMeterFilter !== 'All' },
    job_description:{ options: JOB_DESCRIPTION_OPTIONS,value: jobDescriptionFilter,set: setJobDescriptionFilter,isActive: () => jobDescriptionFilter !== 'All' },
    crew_name:      { options: CREW_NAME_OPTIONS,     value: crewNameFilter,      set: setCrewNameFilter,      isActive: () => crewNameFilter !== 'All' },
    fo_type:        { options: FO_TYPE_OPTIONS,       value: foTypeFilter,        set: setFoTypeFilter,        isActive: () => foTypeFilter !== 'All' },
    billed_amount:  { options: BILLED_AMOUNT_OPTIONS, value: billedAmountFilter,  set: setBilledAmountFilter,  isActive: () => billedAmountFilter !== 'All', formatLabel: o => o === 'All' ? 'All' : `₱${o}` },
    for_batch:      { options: BATCH_OPTIONS,         value: batchFilter,         set: setBatchFilter,         isActive: () => batchFilter !== 'All' },
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

  {isAdmin && (
    <>
  <button
    onClick={() => setShowImport(true)}
    className="flex items-center gap-2 border border-slate-200 hover:bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
  >
    <Upload size={15} />
    Import
  </button>

  <input
    type="number"
    min="1"
    value={repeatCount}
    onChange={
      e => setRepeatCount(Number(e.target.value))
    }
    className="
      px-3
      py-2
      border
      border-slate-200
      rounded-lg
      w-24
      text-sm
      focus:outline-none
      focus:ring-2
      focus:ring-blue-500
    "
    placeholder="Qty"
  />

<button
  onClick={() =>
    navigate('/field-orders/add',{
      state:{
        repeatCount,
        currentRepeat:1
      }
    })
  }
  className="
    flex
    items-center
    gap-2
    bg-blue-600
    hover:bg-blue-700
    text-white
    px-4
    py-2
    rounded-lg
    text-sm
    font-medium
    transition-colors
  "
>

<Plus size={16}/>

Add Record

</button>
    </>
  )}

</div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search FO#, Service ID Number, crew, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>


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
            <button
              onClick={deleteSelected}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${selectAllPages ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              Delete {(selectAllPages ? total : selectedRows.length).toLocaleString()} records
            </button>
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
                    const filterCfg = COL_FILTER_KEYS[col.key]
                    const isActive = filterCfg && filterCfg.isActive()
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.w, maxWidth: col.w, background: '#1e293b' }}
                        className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap border-r border-slate-700 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <span className="flex-1 truncate">{col.label}</span>
                          {filterCfg && (
                            <button
                              data-filter-dropdown
                              onClick={e => { e.stopPropagation(); toggleFilter(col.key, e) }}
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
                    <td colSpan={FROZEN_COLS.length + (isAdmin ? 2 : 1)} className="px-4 py-16 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const sel = editRow?.id === row.id
                    const overdue = isOverdue(row)
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
                  {SCROLL_COLS.map(col => {
                    const filterCfg = COL_FILTER_KEYS[col.key]
                    const isActive = filterCfg && filterCfg.isActive()
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.w, maxWidth: col.w, background: '#1e293b' }}
                        className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap border-r border-slate-700 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <span className="flex-1 truncate">{col.label}</span>
                          {filterCfg && (
                            <button
                              data-filter-dropdown
                              onClick={e => { e.stopPropagation(); toggleFilter(col.key, e) }}
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
                    <td colSpan={SCROLL_COLS.length} className="px-4 py-16 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={SCROLL_COLS.length} className="px-4 py-16 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const sel = editRow?.id === row.id
                    const overdue = isOverdue(row)
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
                        {SCROLL_COLS.map(col => (
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

      {/* Edit Drawer */}
      {editRow && editForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closeEdit} />
          <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer Header */}
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

              <fieldset disabled={!isAdmin} className="space-y-6 border-0 p-0 m-0 min-w-0">

              <PS title="Main Information">
                <PF label="Field Order No.">
                  <input value={editForm.field_order_no} onChange={e => sf('field_order_no', e.target.value)} className={iCls} />
                </PF>
                <PF label="Service ID Number">
                  <input value={editForm.service_number} onChange={e => sf('service_number', e.target.value)} className={iCls} />
                </PF>
                <PF label="Status Crew">
                  <select value={editForm.status_crew} onChange={e => sf('status_crew', e.target.value)} className={iCls}>
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
                  <input type="date" value={editForm.date_assign} onChange={e => sf('date_assign', e.target.value)} className={iCls} />
                </PF>
                <PF label="Date Executed">
                  <input type="date" value={editForm.date_executed} onChange={e => sf('date_executed', e.target.value)} className={iCls} />
                </PF>
                <PF label="Type of Meter">
                  <select value={editForm.type_of_meter} onChange={e => sf('type_of_meter', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {TYPE_OF_METER_OPTIONS.slice(1).map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Job Description">
                  <select value={editForm.job_description} onChange={e => sf('job_description', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {JOB_DESCRIPTION_OPTIONS.slice(1).map(o => <option key={o}>{o}</option>)}
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
                  <input value={editForm.location} onChange={e => sf('location', e.target.value)} className={iCls} />
                </PF>
                <PF label="For Check">
                  <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                    <input type="checkbox" checked={!!editForm.for_check} onChange={e => sf('for_check', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-600">Checked</span>
                  </label>
                </PF>
              </PS>

              <PS title="Remove Meter">
                <PF label="Remove Meter No.">
                  <input value={editForm.remove_meter} onChange={e => sf('remove_meter', e.target.value)} className={iCls} />
                </PF>
                <PF label="R. Serial Number">
                  <input value={editForm.r_serial_number} onChange={e => sf('r_serial_number', e.target.value)} className={iCls} />
                </PF>
                <PF label="Demand Seal Aerolock">
                  <input value={editForm.demand_seal_aerolock} onChange={e => sf('demand_seal_aerolock', e.target.value)} className={iCls} />
                </PF>
                <PF label="Removed Seal">
                  <input value={editForm.removed_seal} onChange={e => sf('removed_seal', e.target.value)} className={iCls} />
                </PF>
                <PF label="Cabinet Seal (Remove)">
                  <input value={editForm.cabinet_seal_remove} onChange={e => sf('cabinet_seal_remove', e.target.value)} className={iCls} />
                </PF>
                <PF label="Reading (kWh)">
                  <input value={editForm.reading_kwh} onChange={e => sf('reading_kwh', e.target.value)} className={iCls} />
                </PF>
                <PF label="DEMAND (kWh)/Cum Demand">
                  <input value={editForm.demand_kwh_cum} onChange={e => sf('demand_kwh_cum', e.target.value)} className={iCls} />
                </PF>
              </PS>

              <PS title="New Installed Meter">
                <PF label="Installed Meter No.">
                  <input value={editForm.ins_meter} onChange={e => sf('ins_meter', e.target.value)} className={iCls} />
                </PF>
                <PF label="Serial Number">
                  <input value={editForm.ins_serial_number} onChange={e => sf('ins_serial_number', e.target.value)} className={iCls} />
                </PF>
                <PF label="Demand Seal (5)">
                  <input value={editForm.demand_seal_installed} onChange={e => sf('demand_seal_installed', e.target.value)} className={iCls} />
                </PF>
                <PF label="Installed Seal (1)">
                  <input value={editForm.installed_seal} onChange={e => sf('installed_seal', e.target.value)} className={iCls} />
                </PF>
                <PF label="Cabinet Seal (2)">
                  <input value={editForm.cabinet_seal_installed} onChange={e => sf('cabinet_seal_installed', e.target.value)} className={iCls} />
                </PF>
                <PF label="TLN Tag">
                  <input value={editForm.tln_tag} onChange={e => sf('tln_tag', e.target.value)} className={iCls} />
                </PF>
                <PF label="Pole Tag">
                  <input value={editForm.pole_tag} onChange={e => sf('pole_tag', e.target.value)} className={iCls} />
                </PF>
                <PF label="Booba Number">
                  <input value={editForm.booba_number} onChange={e => sf('booba_number', e.target.value)} className={iCls} />
                </PF>
                <PF label="MDLTR No.">
                  <input value={editForm.mdltr_no} onChange={e => sf('mdltr_no', e.target.value)} className={iCls} />
                </PF>
                <PF label="Aging (days)">
                  <input type="number" value={editForm.aging} onChange={e => sf('aging', e.target.value)} className={iCls} />
                </PF>
                <PF label="Witness Date">
                  <input type="date" value={editForm.witness_date} onChange={e => sf('witness_date', e.target.value)} className={iCls} />
                </PF>
              </PS>

              <PS title="Remarks & Batch">
                <PF label="FO Type">
                  <select value={editForm.fo_type} onChange={e => sf('fo_type', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {FO_TYPE_OPTIONS.slice(1).map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Billed Amount (₱)">
                  <select value={editForm.billed_amount} onChange={e => sf('billed_amount', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {BILLED_AMOUNT_OPTIONS.slice(1).map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="For Batch">
                  <select value={editForm.for_batch} onChange={e => sf('for_batch', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {BATCH_OPTIONS.slice(1).map(o => <option key={o}>{o}</option>)}
                  </select>
                </PF>
                <PF label="Date Returned">
                  <input type="date" value={editForm.date_returned} onChange={e => sf('date_returned', e.target.value)} className={iCls} />
                </PF>
                <PF label="Crew Payrol (₱)">
                  <input type="number" step="0.01" value={editForm.crew_payrol} onChange={e => sf('crew_payrol', e.target.value)} className={iCls} />
                </PF>
                <PF label="Percentage (%)">
                  <input value={editForm.percentage} onChange={e => sf('percentage', e.target.value)} className={iCls} />
                </PF>
                <PF label="Plus Code">
                  <input value={editForm.pluscode} onChange={e => sf('pluscode', e.target.value)} className={iCls} />
                </PF>
                <PF label="MFLT Checklist">
                  <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                    <input type="checkbox" checked={!!editForm.mflt_checklist} onChange={e => sf('mflt_checklist', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-600">Checked</span>
                  </label>
                </PF>
                <PF label="Remarks" span2>
  <textarea
    value={editForm.remarks}
    onChange={e => sf('remarks', e.target.value)}
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
                {isAdmin ? (
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
        </>
      )}

      {showDeletionRequest && editRow && (
        <RequestDeletionModal
          record={editRow}
          onClose={() => setShowDeletionRequest(false)}
          onSubmitted={() => { setShowDeletionRequest(false); closeEdit() }}
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

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { fetchRecords(); setShowImport(false) }}
        />
      )}

      {/* Column filter dropdown overlay */}
      {openFilterKey && COL_FILTER_KEYS[openFilterKey] && (() => {
        const cfg = COL_FILTER_KEYS[openFilterKey]
        return (
          <div
            data-filter-dropdown
            style={{ position: 'fixed', left: filterPos.x, top: filterPos.y, zIndex: 1000 }}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 min-w-[180px] max-h-72 overflow-y-auto"
          >
            {cfg.type === 'date' ? (
              <div className="p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by date</p>
                <input
                  type="date"
                  value={cfg.value}
                  onChange={e => cfg.set(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {cfg.value && (
                  <button
                    onClick={() => { cfg.set(''); setOpenFilterKey(null) }}
                    className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              cfg.options.map(o => {
                const isSelected = cfg.value === o
                const label = cfg.formatLabel ? cfg.formatLabel(o) : o
                return (
                  <button
                    key={o}
                    data-filter-dropdown
                    onClick={() => { cfg.set(o); setOpenFilterKey(null) }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                )
              })
            )}
          </div>
        )
      })()}
    </div>
  )
}