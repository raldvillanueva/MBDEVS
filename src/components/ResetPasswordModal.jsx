import { useState } from 'react'
import { X, KeyRound, Wand2, Eye, EyeOff, CheckCircle2, Copy, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

function generatePassword() {
  // No characters that get misread when someone writes the password down
  // and reads it back: no O/0, no l/I/1.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!user) return null

  const label = user.username || user.email || 'this account'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password should be at least 8 characters.')
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
      // Changing someone else's password needs the service role key, which
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
          body: JSON.stringify({ user_id: user.id, password }),
        },
      )

      const result = await response.json()
      setSubmitting(false)

      if (!response.ok) {
        setError(result.error || 'Could not reset the password.')
        return
      }

      setDone(true)
      onDone?.(user)
    } catch {
      setSubmitting(false)
      setError('Could not reach the server. Check your connection and retry.')
    }
  }

  function copyPassword() {
    navigator.clipboard?.writeText(password).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000) },
      () => {},
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">

        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-6 py-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[#D89B00]" />
            <h2 className="font-semibold text-[#2E2E2E]">
              {done ? 'Password Reset' : 'Reset Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-6">
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 size={36} className="text-emerald-500" />
              <p className="font-semibold text-[#2E2E2E]">
                <span className="font-mono">{label}</span> can sign in again
              </p>
            </div>

            <p className="mb-2 text-center text-sm text-slate-500">
              Give them this password. It is shown here once and cannot be looked up again.
            </p>

            <div className="flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-slate-50 px-3 py-2.5">
              <code className="flex-1 break-all font-mono text-sm text-[#2E2E2E]">{password}</code>
              <button
                onClick={copyPassword}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                title="Copy password"
              >
                <Copy size={15} />
              </button>
            </div>
            {copied && <p className="mt-1 text-xs text-emerald-600">Copied.</p>}

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                If they are signed in somewhere already, that stays signed in until it
                expires. Have them sign out and back in.
              </p>
            </div>

            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-[#D89B00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C58A00]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <p className="mb-4 text-sm text-slate-500">
              Set a new password for <strong className="font-mono text-[#2E2E2E]">{label}</strong>
              {user.full_name ? ` (${user.full_name})` : ''}.
            </p>

            <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              <p>
                Their current password cannot be shown — it is stored scrambled, so
                nobody can read it back. Setting a new one is how a forgotten password
                gets sorted.
              </p>
            </div>

            <label className="mb-1 block text-xs font-semibold text-slate-600">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full rounded-lg border border-[#D9D9D9] px-3 py-2 pr-10 font-mono text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setPassword(generatePassword()); setShowPassword(true); setError('') }}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#D89B00] hover:underline"
            >
              <Wand2 size={12} />
              Generate one
            </button>

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
                disabled={submitting}
                className="rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Set Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
