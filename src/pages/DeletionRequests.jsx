import { useCallback, useEffect, useState } from 'react'
import { Check, X as XIcon, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all']

export default function DeletionRequests() {
  const { session } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    let query = supabase.from('deletion_requests').select('*').order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (search) query = query.ilike('field_order_no', `%${search}%`)
    const { data, error: fetchError } = await query
    if (fetchError) setError('We could not load deletion requests.')
    else setRequests(data || [])
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    fetchRequests()
    const channel = supabase
      .channel('deletion_requests_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deletion_requests' }, () => fetchRequests())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchRequests])

  async function approve(request) {
    setActingId(request.id)
    setError('')
    if (request.field_order_id) {
      const { error: deleteError } = await supabase.from('field_orders').delete().eq('id', request.field_order_id)
      if (deleteError) { setError('We could not delete the field order. Please try again.'); setActingId(null); return }
    }
    const { error: updateError } = await supabase.from('deletion_requests').update({
      status: 'approved', resolved_at: new Date().toISOString(), resolved_by: session.user.id,
    }).eq('id', request.id)
    if (updateError) setError('The record was deleted, but the request could not be marked approved.')
    await fetchRequests()
    setActingId(null)
    setConfirm(null)
  }

  async function reject(request) {
    setActingId(request.id)
    setError('')
    const { error: updateError } = await supabase.from('deletion_requests').update({
      status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: session.user.id,
    }).eq('id', request.id)
    if (updateError) setError('We could not reject this request. Please try again.')
    await fetchRequests()
    setActingId(null)
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Deletion Requests</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review staff-submitted requests to delete field orders.</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Field Order No..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left font-medium">FIELD ORDER</th>
              <th className="px-4 py-3 text-left font-medium">REQUESTED BY</th>
              <th className="px-4 py-3 text-left font-medium">REASON</th>
              <th className="px-4 py-3 text-left font-medium">REQUESTED ON</th>
              <th className="px-4 py-3 text-left font-medium">STATUS</th>
              <th className="px-4 py-3 text-right font-medium">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">Loading deletion requests...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">No {statusFilter !== 'all' ? statusFilter : ''} deletion requests.</td></tr>
            ) : requests.map(request => (
              <tr key={request.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-blue-600">{request.field_order_no || '—'}</td>
                <td className="px-4 py-3">{request.requested_by_name || '—'}</td>
                <td className="px-4 py-3 max-w-[280px] truncate" title={request.reason}>{request.reason}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(request.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      request.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : request.status === 'approved'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {request.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setConfirm({
                          message: `Permanently delete field order ${request.field_order_no || request.field_order_id}?`,
                          onConfirm: () => approve(request),
                        })}
                        disabled={actingId === request.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => reject(request)}
                        disabled={actingId === request.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-60"
                      >
                        <XIcon size={14} /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
