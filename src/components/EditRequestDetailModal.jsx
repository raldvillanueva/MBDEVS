import { X, Check, X as XIcon, User, Calendar, MapPin, FileText } from 'lucide-react'
import { SECTOR_LABELS } from '../lib/sectorTables'
import { labelFor, displayValue } from '../lib/fieldLabels'

const STATUS_TINT = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-600',
}

function Meta({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        <Icon size={12} />
        {label}
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  )
}

export default function EditRequestDetailModal({ request, onClose, onApprove, onReject, acting }) {
  if (!request) return null

  const changes = Object.entries(request.changes || {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Edit Request</p>
            <h2 className="font-mono text-lg font-bold text-slate-800">
              {request.field_order_no || `ID #${request.field_order_id}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TINT[request.status] || STATUS_TINT.rejected}`}>
              {request.status.toUpperCase()}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Meta icon={User} label="Requested by">
              {request.requested_by_name || '—'}
            </Meta>
            <Meta icon={Calendar} label="Requested on">
              {new Date(request.created_at).toLocaleString()}
            </Meta>
            <Meta icon={MapPin} label="Sector">
              {SECTOR_LABELS[request.sector] || request.sector || '—'}
            </Meta>
          </div>

          <div>
            <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <FileText size={12} />
              Reason
            </div>
            {/* whitespace-pre-wrap, not truncate: the reason is the whole
                point of opening this, so it is shown in full however long
                it is and however it was typed. */}
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {request.reason || <span className="text-slate-400">No reason given</span>}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Proposed changes
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {changes.length}
              </span>
            </h3>

            {changes.length === 0 ? (
              <p className="text-sm text-slate-400">No field changes recorded on this request.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2 text-left font-semibold">Field</th>
                      <th className="px-4 py-2 text-left font-semibold">From</th>
                      <th className="px-4 py-2 text-left font-semibold">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Every change, not the first three the row shows —
                        approving applies all of them, so all of them have to
                        be readable before deciding. */}
                    {changes.map(([field, { old: oldValue, new: newValue }]) => (
                      <tr key={field} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{labelFor(field)}</td>
                        <td className="px-4 py-2.5 text-slate-400 line-through decoration-red-400">
                          {displayValue(oldValue)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-emerald-700">
                          {displayValue(newValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {request.status !== 'pending' && request.resolved_at && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {request.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
              {new Date(request.resolved_at).toLocaleString()}.
            </p>
          )}
        </div>

        {request.status === 'pending' && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              onClick={() => onReject(request)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-60"
            >
              <XIcon size={15} /> Reject
            </button>
            <button
              onClick={() => onApprove(request)}
              disabled={acting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Check size={15} />
              Apply {changes.length} change{changes.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
