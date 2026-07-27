import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { X, Save, CheckCircle, Search } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const STATUS_CREW_OPTIONS = ['FOR ASSIGN', 'ASSIGNED', 'REASSIGN','CANCEL', 'CANCEL-EMC', 'FC CANCEL', 'FIELD COMPLETED', 'REVISITED FIELD COM.', 'REVISITED CANCEL']
const TYPE_OF_METER_OPTIONS = ['12S', '12S ID METER', '1S', '1S EMC L-G', '25S', '2S EMC L-G', '2S EMC L-L', '2S EMX', '2S ID', '2S ID METER', '2S ID METER/ERC', '2S PLAIN METER', '9S', 'EMX', 'ERC 2S PLAIN METER', 'FOR REPLACE', 'KLOAD', 'RETURNED']
const JOB_DESCRIPTION_OPTIONS = ['REPLACE', 'REPLACE-EMC', 'REPLACE-EMX', 'RETIRE', 'RETIRE-EMC', 'RETIRE-EMC-WIRE']
const CREW_NAME_OPTIONS = ['A. TOMADA', 'B. VERDARERO', 'C. BENIGNO', 'D. FABOL', 'E. VILLAREAL', 'J. BITAGO', 'J. J. SERRANO']
const FO_TYPE_OPTIONS = ['CANCEL', 'CANCEL-EMC', 'CUT SERVICE ENTRANCE', 'ENERGIZED', 'REMOVE', 'REMOVE-EMC', 'REMOVE-EMC-WIRE', 'REPLACE', 'REPLACE-EMC', 'REPLACE-EMX']
const BILLED_AMOUNT_OPTIONS = ['0', '172.45', '253.43', '344.9', '383.22', '574.83', '766.44', '958.05', '1013.71', '1689.61']
const BATCH_OPTIONS = ['ALREADY BATCH', 'FOR BATCH', 'MISSING METER', 'OTHERS PENDING']

const EMPTY_FORM = {
  status_crew: '', date_assign: '', for_check: false, date_executed: '', type_of_meter: '',
  job_description: '', crew_name: '', location: '', service_number: '', field_order_no: '',
  remove_meter: '', r_serial_number: '', demand_seal_aerolock: '', removed_seal: '',
  cabinet_seal_remove: '', reading_kwh: '', ins_meter: '', ins_serial_number: '',
  demand_seal_installed: '', installed_seal: '', cabinet_seal_installed: '', tln_tag: '',
  pole_tag: '', booba_number: '', mdltr_no: '', aging: '', witness_date: '', remarks: '',
  mflt_checklist: false, fo_type: '', billed_amount: '', for_batch: '', date_returned: '',
  crew_payrol: '', pluscode: '',
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

function friendlySaveError(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('invalid input syntax') || message.includes('invalid input')) {
    return 'One or more entries have an invalid format. Please check the values and try again.'
  }
  if (message.includes('duplicate') || message.includes('unique')) {
    return 'This record already exists. Please check the Field Order and Installed Meter numbers.'
  }
  if (message.includes('not-null') || message.includes('null value')) {
    return 'Please complete all required information before saving.'
  }

  return 'We could not save your changes. Please check the information and try again.'
}

export default function PendingRecords() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('STACK')
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingToFO, setSavingToFO] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedRows, setSelectedRows] = useState([])
  const [bulkAction, setBulkAction] = useState(null)
  const [pageError, setPageError] = useState('')

  const filtered = pending.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.field_order_no?.toLowerCase().includes(q) ||
      r.ins_meter?.toLowerCase().includes(q) ||
      r.crew_name?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.service_number?.toLowerCase().includes(q)
    )
  })
  const displayPending = mode === 'QUEUE' ? [...filtered] : [...filtered].reverse()

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('pending_orders').select('*').order('created_at', { ascending: false })
    if (data) {
      setPending(data)
      setSelectedRows(previous => previous.filter(id => data.some(row => row.id === id)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPending()
    const channel = supabase
      .channel('pending_records_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_orders' }, () => fetchPending())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchPending])

  useEffect(() => { setSelectedRows([]) }, [search])

  function openEdit(row) {
    setEditRow(row)
    const f = { ...EMPTY_FORM }
    for (const k of Object.keys(EMPTY_FORM)) f[k] = row[k] ?? EMPTY_FORM[k]
    setEditForm(f)
    setSaveError('')
  }

  function closeEdit() { setEditRow(null); setEditForm(null) }
  function sf(field, value) { setEditForm(prev => ({ ...prev, [field]: value })) }
  function toPayload(record) {
    const { id, created_at, ...rest } = record
    return {
      ...rest,
      aging: rest.aging === '' || rest.aging == null ? null : parseInt(rest.aging, 10),
      billed_amount: rest.billed_amount === '' || rest.billed_amount == null ? null : parseFloat(rest.billed_amount),
      crew_payrol: rest.crew_payrol === '' || rest.crew_payrol == null ? null : parseFloat(rest.crew_payrol),
      date_assign: rest.date_assign || null,
      date_executed: rest.date_executed || null,
      witness_date: rest.witness_date || null,
      date_returned: rest.date_returned || null,
    }
  }
  function savePayload() { return toPayload(editForm) }

  async function updatePending() {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('pending_orders').update(savePayload()).eq('id', editRow.id)
    setSaving(false)
    if (error) { setSaveError(friendlySaveError(error)); return }
    fetchPending()
    closeEdit()
  }

  async function saveToFieldOrders() {
    setSavingToFO(true)
    setSaveError('')
    const payload = savePayload()
    const { error } = await supabase.from('new_work_orders').insert([payload])
    if (error) { setSaveError(friendlySaveError(error)); setSavingToFO(false); return }
    await supabase.from('pending_orders').delete().eq('id', editRow.id)
    setSavingToFO(false)
    fetchPending()
    closeEdit()
  }

  function removePending(id) {
    setConfirm({
      message: 'Remove this pending record? This cannot be undone.',
      onConfirm: async () => {
        await supabase.from('pending_orders').delete().eq('id', id)
        fetchPending()
        setConfirm(null)
        if (editRow?.id === id) closeEdit()
      }
    })
  }
  function toggleRow(id) {
  setSelectedRows(prev =>
    prev.includes(id)
      ? prev.filter(x => x !== id)
      : [...prev, id]
  )
}

function toggleAll() {
  if (selectedRows.length === displayPending.length) {
    setSelectedRows([])
  } else {
    setSelectedRows(displayPending.map(r => r.id))
  }
}

async function bulkDelete() {
  if (selectedRows.length === 0) return

  setConfirm({
    message: `Delete ${selectedRows.length} pending record(s)?`,
    onConfirm: async () => {
      setConfirm(null)
      setBulkAction('delete')
      setPageError('')
      const { error } = await supabase
        .from('pending_orders')
        .delete()
        .in('id', selectedRows)

      if (error) setPageError('We could not delete the selected records. Please try again.')
      setSelectedRows([])
      await fetchPending()
      closeEdit()
      setBulkAction(null)
    }
  })
}

async function sendSelectedToNewWork() {
  if (selectedRows.length === 0) return
  const selected = pending.filter(row => selectedRows.includes(row.id))
  setBulkAction('send')
  setPageError('')
  const { error: insertError } = await supabase.from('new_work_orders').insert(selected.map(toPayload))
  if (insertError) { setPageError(friendlySaveError(insertError)); setBulkAction(null); return }
  const { error: deleteError } = await supabase.from('pending_orders').delete().in('id', selectedRows)
  if (deleteError) setPageError('The selected records were sent, but some could not be removed from Pending. Please refresh the page.')
  setSelectedRows([])
  await fetchPending()
  closeEdit()
  setBulkAction(null)
}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }} className="gap-4">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pending Records</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtered.length} of {pending.length} pending • Click a row to edit
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && selectedRows.length > 0 && (
  <>
    <button
      onClick={sendSelectedToNewWork}
      disabled={!!bulkAction}
      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {bulkAction === 'send' ? 'Sending…' : `Send Selected (${selectedRows.length})`}
    </button>
    <button
      onClick={bulkDelete}
      disabled={!!bulkAction}
      className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {bulkAction === 'delete' ? 'Deleting…' : `Delete Selected (${selectedRows.length})`}
    </button>
  </>
)}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search FO#, meter, crew, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
          </div>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="STACK">STACK</option>
            <option value="QUEUE">QUEUE</option>
          </select>
        </div>
      </div>

      {pageError && (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: '#1e293b' }}>
                {isAdmin && (
                  <th className="px-3 py-2.5"> <input type="checkbox" checked={ displayPending.length > 0 && selectedRows.length === displayPending.length} onChange={toggleAll}/></th>
                )}
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">FIELD ORDER</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">INSTALLED METER</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">CREW NAME</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">SERVICE ID NUMBER</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">DATE ADDED</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">STATUS</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-300 whitespace-nowrap">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-16 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : displayPending.length === 0 ? (
                <tr>
                 <td colSpan={isAdmin ? 9 : 8} className="px-4 py-16 text-center text-slate-400">
                    No pending records.
                  </td>
                </tr>
              ) : (
                displayPending.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => editRow?.id === row.id ? closeEdit() : openEdit(row)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors ${
                      editRow?.id === row.id
                        ? 'bg-blue-50 outline outline-2 outline-blue-400 outline-offset-[-2px]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleRow(row.id)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600 font-medium">{row.field_order_no || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600">{row.ins_meter || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.crew_name || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap">{row.service_number || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-orange-500 font-semibold">PENDING</td>
                    <td className="px-3 py-2.5">
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); removePending(row.id) }}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-sm text-slate-500">
          {search ? `${filtered.length} of ${pending.length}` : pending.length} pending record{pending.length !== 1 ? 's' : ''}
          {search && filtered.length === 0 && <span className="ml-2 text-slate-400">— no matches for "{search}"</span>}
        </div>
      </div>

      {/* Edit Drawer */}
      {editRow && editForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closeEdit} />
          <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col">

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Pending Record</p>
                <h2 className="font-mono font-bold text-slate-800 text-lg">{editRow.field_order_no || `ID #${editRow.id}`}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <button
                      onClick={saveToFieldOrders}
                      disabled={savingToFO || saving}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCircle size={13} />
                      {savingToFO ? 'Saving…' : 'Send to New Work'}
                    </button>
                    <button
                      onClick={updatePending}
                      disabled={saving || savingToFO}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Save size={13} />
                      {saving ? 'Saving…' : 'Update'}
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
                    {STATUS_CREW_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="Date Assign">
                  <input type="date" value={editForm.date_assign} onChange={e => sf('date_assign', e.target.value)} className={iCls} />
                </PF>
                <PF label="Date Execution">
                  <input type="date" value={editForm.date_executed} onChange={e => sf('date_executed', e.target.value)} className={iCls} />
                </PF>
                <PF label="Type of Meter">
                  <select value={editForm.type_of_meter} onChange={e => sf('type_of_meter', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {TYPE_OF_METER_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF> 
                <PF label="Job Description">
                  <select value={editForm.job_description} onChange={e => sf('job_description', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {JOB_DESCRIPTION_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="Crew Name">
                  <select value={editForm.crew_name} onChange={e => sf('crew_name', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {CREW_NAME_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
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
                    {FO_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="Billed Amount (₱)">
                  <select value={editForm.billed_amount} onChange={e => sf('billed_amount', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {BILLED_AMOUNT_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="For Batch">
                  <select value={editForm.for_batch} onChange={e => sf('for_batch', e.target.value)} className={iCls}>
                    <option value="">— Select —</option>
                    {BATCH_OPTIONS.map(option => <option key={option}>{option}</option>)}
                  </select>
                </PF>
                <PF label="Date Returned">
                  <input type="date" value={editForm.date_returned} onChange={e => sf('date_returned', e.target.value)} className={iCls} />
                </PF>
                <PF label="Crew Payrol (₱)">
                  <input type="number" step="0.01" value={editForm.crew_payrol} onChange={e => sf('crew_payrol', e.target.value)} className={iCls} />
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
                  <textarea value={editForm.remarks} onChange={e => sf('remarks', e.target.value)} rows={3} className={`${iCls} resize-none`} />
                </PF>
              </PS>

              </fieldset>

              {isAdmin && (
                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => removePending(editRow.id)}
                    className="w-full px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    Remove from Pending
                  </button>
                </div>
              )}

            </div>
          </div>
        </>
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
              <button onClick={confirm.onConfirm} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
