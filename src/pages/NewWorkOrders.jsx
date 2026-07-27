import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Save, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SECTIONS = [
  ['Main Information', [
    ['field_order_no', 'Field Order No.'], ['service_number', 'Service ID Number'],
    ['status_crew', 'Status Crew'], ['date_assign', 'Date Assign', 'date'],
    ['date_executed', 'Date Execution', 'date'], ['type_of_meter', 'Type of Meter'],
    ['job_description', 'Job Description'], ['crew_name', 'Crew Name'], ['location', 'Location'],
  ]],
  ['Remove Meter', [
    ['remove_meter', 'Remove Meter No.'], ['r_serial_number', 'R. Serial Number'],
    ['demand_seal_aerolock', 'Demand Seal Aerolock'], ['removed_seal', 'Removed Seal'],
    ['cabinet_seal_remove', 'Cabinet Seal (Remove)'], ['reading_kwh', 'Reading (kWh)'],
  ]],
  ['New Installed Meter', [
    ['ins_meter', 'Installed Meter No.'], ['ins_serial_number', 'Serial Number'],
    ['demand_seal_installed', 'Demand Seal (5)'], ['installed_seal', 'Installed Seal (1)'],
    ['cabinet_seal_installed', 'Cabinet Seal (2)'], ['tln_tag', 'TLN Tag'], ['pole_tag', 'Pole Tag'],
    ['booba_number', 'Booba Number'], ['mdltr_no', 'MDLTR No.'], ['aging', 'Aging (days)', 'number'],
    ['witness_date', 'Witness Date', 'date'],
  ]],
  ['Remarks & Batch', [
    ['fo_type', 'FO Type'], ['billed_amount', 'Billed Amount (₱)', 'number'],
    ['for_batch', 'For Batch'], ['date_returned', 'Date Returned', 'date'],
    ['crew_payrol', 'Crew Payroll (₱)', 'number'], ['pluscode', 'Plus Code'], ['remarks', 'Remarks'],
  ]],
]

const inputClass = 'w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const SELECT_OPTIONS = {
  status_crew: ['FOR ASSIGN', 'ASSIGNED', 'REASSIGN','CANCEL', 'CANCEL-EMC', 'FC CANCEL', 'FIELD COMPLETED', 'REVISITED FIELD COM.', 'REVISITED CANCEL'],
  type_of_meter: ['12S', '12S ID METER', '1S', '1S EMC L-G', '25S', '2S EMC L-G', '2S EMC L-L', '2S EMX', '2S ID', '2S ID METER', '2S ID METER/ERC', '2S PLAIN METER', '9S', 'EMX', 'ERC 2S PLAIN METER', 'FOR REPLACE', 'KLOAD', 'RETURNED'],
  job_description: ['REPLACE', 'REPLACE-EMC', 'REPLACE-EMX', 'RETIRE', 'RETIRE-EMC', 'RETIRE-EMC-WIRE'],
  crew_name: ['A. TOMADA', 'B. VERDARERO', 'C. BENIGNO', 'D. FABOL', 'E. VILLAREAL', 'J. BITAGO', 'J. J. SERRANO'],
  fo_type: ['CANCEL', 'CANCEL-EMC', 'CUT SERVICE ENTRANCE', 'ENERGIZED', 'REMOVE', 'REMOVE-EMC', 'REMOVE-EMC-WIRE', 'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX'],
  billed_amount: ['0', '172.45', '253.43', '344.9', '383.22', '574.83', '766.44', '958.05', '1013.71', '1689.61'],
  for_batch: ['ALREADY BATCH', 'FOR BATCH', 'MISSING METER', 'OTHERS PENDING'],
}

function friendlyError(error) {
  const message = error?.message?.toLowerCase() || ''
  if (error?.code === '42P01') return 'New Work Orders is not set up in the database yet.'
  if (message.includes('invalid input')) return 'One or more entries have an invalid format. Please check the values and try again.'
  if (message.includes('duplicate') || message.includes('unique')) return 'This work order already exists in Field Orders.'
  return 'We could not complete that action. Please try again.'
}

function savePayload(record) {
  const payload = Object.fromEntries(
    Object.entries(record).filter(
      ([key]) =>
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'percentage'
    )
  )

  return {
    ...payload,
    aging: payload.aging === '' || payload.aging == null ? null : parseInt(payload.aging, 10),
    billed_amount: payload.billed_amount === '' || payload.billed_amount == null ? null : parseFloat(payload.billed_amount),
    crew_payrol: payload.crew_payrol === '' || payload.crew_payrol == null ? null : parseFloat(payload.crew_payrol),
    date_assign: payload.date_assign || null,
    date_executed: payload.date_executed || null,
    witness_date: payload.witness_date || null,
    date_returned: payload.date_returned || null,
  }
}

export default function NewWorkOrders() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [movingId, setMovingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkCompleting, setBulkCompleting] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    let query = supabase.from('new_work_orders').select('*').order('created_at', { ascending: false })
    if (search) query = query.or(`field_order_no.ilike.%${search}%,service_number.ilike.%${search}%,crew_name.ilike.%${search}%,ins_meter.ilike.%${search}%`)
    const { data, error: fetchError } = await query
    if (fetchError) setError(friendlyError(fetchError))
    else {
      setRecords(data || [])
      setSelectedIds(previous => previous.filter(id => (data || []).some(record => record.id === id)))
    }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { setSelectedIds([]) }, [search])

  function openEdit(record) { setEditForm({ ...record }); setError('') }
  function closeEdit() { setEditForm(null) }
  function setField(field, value) { setEditForm(previous => ({ ...previous, [field]: value })) }

  function toggleSelect(id) {
    setSelectedIds(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id])
  }

  function toggleSelectAll() {
    setSelectedIds(previous =>
      records.length > 0 && records.every(record => previous.includes(record.id))
        ? []
        : records.map(record => record.id)
    )
  }

  async function updateWorkOrder() {
    setSaving(true)
    setError('')
    const { error: updateError } = await supabase.from('new_work_orders').update(savePayload(editForm)).eq('id', editForm.id)
    setSaving(false)
    if (updateError) { setError(friendlyError(updateError)); return }
    closeEdit()
    fetchRecords()
  }

  async function completeWorkOrder(record) {
    setMovingId(record.id)
    setError('')
    const { error: insertError } = await supabase.from('field_orders').insert([savePayload(record)])
    if (insertError) { setError(friendlyError(insertError)); setMovingId(null); return }
    const { error: deleteError } = await supabase.from('new_work_orders').delete().eq('id', record.id)
    if (deleteError) setError('The work order was completed, but it could not be removed from this list. Please refresh the page.')
    await fetchRecords()
    setMovingId(null)
  }

  async function completeSelected() {
    const selected = records.filter(record => selectedIds.includes(record.id))
    if (selected.length === 0) return
    setBulkCompleting(true)
    setError('')
    const { error: insertError } = await supabase.from('field_orders').insert(selected.map(savePayload))
    if (insertError) { setError(friendlyError(insertError)); setBulkCompleting(false); return }
    const { error: deleteError } = await supabase.from('new_work_orders').delete().in('id', selectedIds)
    if (deleteError) setError('The selected work orders were completed, but some could not be removed from this list. Please refresh the page.')
    setSelectedIds([])
    await fetchRecords()
    setBulkCompleting(false)
  }
 
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4">
      <div><h1 className="text-2xl font-bold text-slate-800">New Work Orders</h1><p className="mt-0.5 text-sm text-slate-500">Work orders sent from Pending Records and ready for completion.</p></div>
      <div className="relative shrink-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search FO#, service ID number, crew, or meter..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex shrink-0 items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <p className="text-sm font-medium text-blue-700">{selectedIds.length} selected</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Clear</button>
            <button onClick={completeSelected} disabled={bulkCompleting} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle size={14} /> {bulkCompleting ? 'Completing...' : `Mark ${selectedIds.length} Completed`}</button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-800 text-xs text-slate-300"><tr>{isAdmin && <th className="w-10 px-4 py-3 text-center font-medium"><input type="checkbox" checked={records.length > 0 && records.every(record => selectedIds.includes(record.id))} onChange={toggleSelectAll} /></th>}<th className="px-4 py-3 text-left font-medium">FIELD ORDER</th><th className="px-4 py-3 text-left font-medium">INSTALLED METER</th><th className="px-4 py-3 text-left font-medium">CREW NAME</th><th className="px-4 py-3 text-left font-medium">SERVICE ID NUMBER</th><th className="px-4 py-3 text-left font-medium">STATUS</th><th className="px-4 py-3 text-right font-medium">ACTION</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center text-slate-400">Loading new work orders...</td></tr> : records.length === 0 ? <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center text-slate-400">No new work orders.</td></tr> : records.map(record => <tr key={record.id} onClick={() => openEdit(record)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">{isAdmin && <td className="px-4 py-3 text-center" onClick={event => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleSelect(record.id)} /></td>}<td className="px-4 py-3 font-mono text-blue-600">{record.field_order_no || '—'}</td><td className="px-4 py-3">{record.ins_meter || '—'}</td><td className="px-4 py-3">{record.crew_name || '—'}</td><td className="px-4 py-3">{record.service_number || '—'}</td><td className="px-4 py-3"><span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">NEW</span></td><td className="px-4 py-3 text-right">{isAdmin && <button onClick={event => { event.stopPropagation(); completeWorkOrder(record) }} disabled={movingId === record.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle size={14} /> {movingId === record.id ? 'Completing...' : 'Mark Completed'}</button>}</td></tr>)}</tbody>
        </table>
      </div>

      {editForm && <><div className="fixed inset-0 z-40 bg-black/20" onClick={closeEdit} /><aside className="fixed right-0 top-0 z-50 flex h-full w-[500px] flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">New Work Order</p><h2 className="font-mono text-lg font-bold text-slate-800">{editForm.field_order_no || `ID #${editForm.id}`}</h2></div><div className="flex items-center gap-2">{isAdmin && <button onClick={updateWorkOrder} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Save size={14} />{saving ? 'Saving...' : 'Update'}</button>}<button onClick={closeEdit} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div></header><div className="flex-1 overflow-y-auto px-5 py-5"><fieldset disabled={!isAdmin} className="space-y-6 border-0 p-0 m-0 min-w-0">{SECTIONS.map(([title, fields]) => <section key={title}><h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3><div className="grid grid-cols-2 gap-3">{fields.map(([key, label, type]) => <label key={key} className={key === 'location' || key === 'remarks' ? 'col-span-2' : ''}><span className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</span>{key === 'remarks' ? <textarea rows={3} value={editForm[key] ?? ''} onChange={event => setField(key, event.target.value)} className={`${inputClass} resize-none`} /> : SELECT_OPTIONS[key] ? <select value={editForm[key] ?? ''} onChange={event => setField(key, event.target.value)} className={inputClass}><option value="">— Select —</option>{SELECT_OPTIONS[key].map(option => <option key={option}>{option}</option>)}</select> : <input type={type || 'text'} value={editForm[key] ?? ''} onChange={event => setField(key, event.target.value)} className={inputClass} />}</label>)}</div></section>)}</fieldset></div></aside></>}
    </div>
  )
}
