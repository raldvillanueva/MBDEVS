import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSector } from '../lib/SectorContext'
import { useAuth } from '../lib/AuthContext'
import { labelFor, displayValue } from '../lib/fieldLabels'

// record: the row being edited. changes: { field: { old, new } } — only
// the fields that actually differ, computed by the caller.
export default function RequestEditModal({ record, changes, onClose, onSubmitted }) {
  const { session, profile } = useAuth()
  const { sector } = useSector()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const changedFields = Object.keys(changes || {})

  async function submit() {
    if (!reason.trim()) { setError('Please provide a reason.'); return }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('edit_requests').insert([{
      field_order_id: record.id,
      field_order_no: record.field_order_no,
      // Records live in per-sector tables, so the approver needs to know
      // which table these changes apply to.
      sector,
      requested_by: session.user.id,
      requested_by_name: profile?.full_name || session.user.email,
      reason: reason.trim(),
      changes,
    }])
    setSaving(false)
    if (insertError) { setError('We could not submit the request. Please try again.'); return }
    onSubmitted()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-slate-800 text-lg">Request Edit</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-slate-500 text-sm">
          Field order <span className="font-mono font-semibold text-slate-700">{record.field_order_no || record.id}</span> will
          be flagged for an admin to review. Nothing changes until it's approved.
        </p>

        {changedFields.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {changedFields.map(field => (
              <div key={field} className="px-3 py-2 text-xs">
                <div className="font-medium text-slate-600">{labelFor(field)}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
                  <span className="line-through decoration-red-400">{displayValue(changes[field].old)}</span>
                  <span className="text-slate-300">→</span>
                  <span className="text-emerald-700 font-medium">{displayValue(changes[field].new)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
        )}
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value.slice(0, 100))}
          maxLength={100}
          rows={3}
          placeholder="Reason for this change..."
          className="w-full mt-3 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="text-right text-xs text-slate-400 mt-1">{reason.length}/100</div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || changedFields.length === 0}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
