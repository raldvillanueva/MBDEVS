import { useState } from 'react'
import { X, Pencil, AlertTriangle, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SECTOR_LABELS, DATA_SECTORS } from '../lib/sectorTables'

export default function EditAccountModal({ user, onClose, onSaved }) {
  const [username, setUsername] = useState(user?.username || '')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  // Held as an array even for one sector, so nothing downstream has to
  // handle "sometimes a string, sometimes a list".
  const [sectors, setSectors] = useState(() =>
    Array.isArray(user?.sectors) ? [...user.sectors] : [],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null

  function toggleSector(key) {
    setError('')
    setSectors(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key],
    )
  }

  // Only what actually changed is sent. A field left alone is left out of
  // the request entirely, so an edit to one thing cannot quietly rewrite
  // another — and an unchanged email does not trigger a pointless write to
  // the auth record.
  const changes = {}
  if (username.trim() !== (user.username || '')) changes.username = username.trim()
  if (fullName.trim() !== (user.full_name || '')) changes.full_name = fullName.trim()
  if (email.trim().toLowerCase() !== (user.email || '').toLowerCase()) changes.email = email.trim()
  // Order is not meaningful, so a reorder is not a change. Comparing the
  // sorted lists stops Save lighting up when nothing really differs.
  const originalSectors = Array.isArray(user.sectors) ? [...user.sectors].sort() : []
  if (JSON.stringify([...sectors].sort()) !== JSON.stringify(originalSectors)) {
    changes.sectors = sectors
  }

  const changedCount = Object.keys(changes).length
  const usernameChanged = 'username' in changes

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Username cannot be empty — it is how this person signs in.')
      return
    }
    if (changedCount === 0) {
      onClose?.()
      return
    }

    setSubmitting(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    if (!token) {
      setSubmitting(false)
      setError('Your session has expired. Sign in again and retry.')
      return
    }

    try {
      // Changing another account's email needs the service role key, which
      // can never reach a browser — so this goes through admin-users, which
      // re-checks server-side that the caller is a Super Admin.
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: user.id, ...changes }),
        },
      )

      const result = await response.json()
      setSubmitting(false)

      if (!response.ok) {
        setError(result.error || 'Could not save the changes.')
        return
      }

      onSaved?.(user, changes)
      onClose?.()
    } catch {
      setSubmitting(false)
      setError('Could not reach the server. Check your connection and retry.')
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">

        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil size={17} className="text-[#D89B00]" />
            <h2 className="font-semibold text-[#2E2E2E]">Edit Account</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Username (used to sign in)
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="MB0001"
                autoCapitalize="none"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError('') }}
                placeholder="Juan Dela Cruz"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="name@mbdevs.com"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Not used to sign in — kept for password resets and one-time codes.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Allowed Sectors <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#D9D9D9] p-2.5">
                {DATA_SECTORS.map(s => (
                  <label
                    key={s}
                    className="flex cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={sectors.includes(s)}
                      onChange={() => toggleSector(s)}
                      className="h-4 w-4 rounded border-slate-300 text-[#D89B00] focus:ring-[#D89B00]"
                    />
                    {SECTOR_LABELS[s]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {sectors.length === 0
                  ? 'Nothing ticked — this account can use every sector.'
                  : `Can only use ${sectors.length} of ${DATA_SECTORS.length} sectors. MBDEVCO is not reachable.`}
              </p>
            </div>
          </div>

          {usernameChanged && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                This person signs in with their username. Tell them it is now{' '}
                <strong className="font-mono">{changes.username}</strong> or they will be
                locked out at the next sign-in.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              To change what this account is allowed to do, use the dropdown on its row.
              For a new password, use Reset.
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || changedCount === 0}
              className="rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
              title={changedCount === 0 ? 'Nothing has been changed yet' : undefined}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
