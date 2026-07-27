import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchiveRestore, Pencil, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ArchivedWorkOrders() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selectedRows, setSelectedRows] = useState([])
  const [restoringId, setRestoringId] = useState(null)
  const [bulkRestoring, setBulkRestoring] = useState(false)
  const navigate = useNavigate()

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    let query = supabase
      .from('field_orders')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    if (search) {
      query = query.or(`field_order_no.ilike.%${search}%,service_number.ilike.%${search}%,crew_name.ilike.%${search}%,ins_meter.ilike.%${search}%`)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError('We could not load archived work orders. Please try again.')
    } else {
      setRecords(data || [])
      setSelectedRows(previous => previous.filter(id => (data || []).some(record => record.id === id)))
    }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { setSelectedRows([]) }, [search])

  async function restoreRecord(id) {
    setRestoringId(id)
    const { error: restoreError } = await supabase
      .from('field_orders')
      .update({ archived_at: null })
      .eq('id', id)

    if (restoreError) {
      setError('We could not restore this work order. Please try again.')
      setRestoringId(null)
      return
    }
    await fetchRecords()
    setRestoringId(null)
  }
    function toggleRow(id) {
  setSelectedRows(prev =>
    prev.includes(id)
      ? prev.filter(x => x !== id)
      : [...prev, id]
  )
}

function toggleAll() {
  if (selectedRows.length === records.length) {
    setSelectedRows([])
  } else {
    setSelectedRows(records.map(r => r.id))
  }
}

async function restoreSelected() {
  if (selectedRows.length === 0) return

  setBulkRestoring(true)
  setError('')
  const { error } = await supabase
    .from('field_orders')
    .update({
      archived_at: null
    })
    .in('id', selectedRows)

  if (error) {
    setError('We could not restore the selected work orders.')
    setBulkRestoring(false)
    return
  }

  setSelectedRows([])
  await fetchRecords()
  setBulkRestoring(false)
}
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Archived Work Orders</h1>
        <p className="mt-0.5 text-sm text-slate-500">Completed work orders kept for reference.</p>
      </div>

      <div className="relative shrink-0">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search FO#, service no., crew, or meter..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isAdmin && selectedRows.length > 0 && (
  <div className="flex justify-end">
    <button
      onClick={restoreSelected}
      disabled={bulkRestoring}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
    >
      <ArchiveRestore size={16} />
      {bulkRestoring ? 'Restoring…' : `Restore Selected (${selectedRows.length})`}
    </button>
  </div>
)}

{error && (
  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
    {error}
  </div>
)}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
         <thead className="sticky top-0 bg-slate-800 text-xs text-slate-300">
  <tr>
    {isAdmin && (
      <th className="px-4 py-3">
        <input
          type="checkbox"
          checked={
            records.length > 0 &&
            selectedRows.length === records.length
          }
          onChange={toggleAll}
        />
      </th>
    )}

    <th className="px-4 py-3 text-left font-medium">FIELD ORDER</th>
              <th className="px-4 py-3 text-left font-medium">INSTALLED METER</th>
              <th className="px-4 py-3 text-left font-medium">CREW NAME</th>
              <th className="px-4 py-3 text-left font-medium">SERVICE ID NUMBER</th>
              <th className="px-4 py-3 text-left font-medium">ARCHIVED ON</th>
              <th className="px-4 py-3 text-right font-medium">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center text-slate-400">Loading archived work orders...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center text-slate-400">No archived work orders.</td></tr>
            ) : records.map(record => (
              <tr key={record.id} className="border-t border-slate-100 hover:bg-slate-50">
                {isAdmin && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(record.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleRow(record.id)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-blue-600">{record.field_order_no || '—'}</td>
                <td className="px-4 py-3">{record.ins_meter || '—'}</td>
                <td className="px-4 py-3">{record.crew_name || '—'}</td>
                <td className="px-4 py-3">{record.service_number || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{record.archived_at ? new Date(record.archived_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-right">
  {isAdmin && (
    <div className="flex justify-end gap-2">

      <button
        onClick={() => navigate(`/field-orders/edit/${record.id}`)}
        disabled={restoringId === record.id}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
      >
        <Pencil size={14} />
        Edit
      </button>

      <button
        onClick={() => restoreRecord(record.id)}
        disabled={restoringId === record.id}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <ArchiveRestore size={14} />
        {restoringId === record.id ? 'Restoring…' : 'Restore'}
      </button>

    </div>
  )}
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
