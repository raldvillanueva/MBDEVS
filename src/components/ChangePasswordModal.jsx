// Changing your own password, from inside the app.
//
// Separate from the Super Admin's reset: that one sets someone else's
// password for them, and is how a forgotten one is recovered. This is the
// everyday case — you know your password and want a different one — and
// it asks for the current one first.
//
// Supabase does not require the current password to set a new one, so
// that check is made here by signing in with it. Without it, anyone who
// found an unlocked machine could lock the real owner out of their own
// account in two clicks.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, KeyRound, Loader2, X, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const MIN_LENGTH = 8

export default function ChangePasswordModal({ onClose }) {
  const { session } = useAuth()
  const email = session?.user?.email || ''

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (next.length < MIN_LENGTH) {
      setError(`Your new password needs at least ${MIN_LENGTH} characters.`)
      return
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.')
      return
    }
    if (next === current) {
      setError('Your new password is the same as your current one.')
      return
    }
    if (!email) {
      setError('Your session has expired. Sign out and back in, then try again.')
      return
    }

    setBusy(true)

    // Signing in with the current password is the check. It is the account
    // that is already signed in, so this replaces the session with an
    // identical one and nothing else changes.
    const { error: wrongPassword } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    })
    if (wrongPassword) {
      setBusy(false)
      setError(
        /rate|too many/i.test(wrongPassword.message || '')
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Your current password is not correct.'
      )
      return
    }

    const { error: failed } = await supabase.auth.updateUser({ password: next })
    setBusy(false)

    if (failed) {
      setError(
        /weak|pwned|compromis/i.test(failed.message || '')
          ? 'That password is too easy to guess. Try a longer one.'
          : failed.message || 'Your password could not be changed. Please try again.'
      )
      return
    }

    setDone(true)
  }

  const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">Change your password</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-6 text-center">
            <CheckCircle size={32} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Your password has been changed.</p>
            <p className="mt-1 text-xs text-slate-500">
              Use the new one next time you sign in. You are still signed in here.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 px-5 py-5">

            <PasswordField
              label="Current password"
              value={current}
              onChange={setCurrent}
              show={show}
              onToggle={() => setShow(s => !s)}
              autoFocus
              className={field}
            />

            <PasswordField
              label="New password"
              value={next}
              onChange={setNext}
              show={show}
              onToggle={() => setShow(s => !s)}
              className={field}
              hint={`At least ${MIN_LENGTH} characters.`}
            />

            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              show={show}
              onToggle={() => setShow(s => !s)}
              className={field}
            />

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !current || !next || !confirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'Changing…' : 'Change password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}

function PasswordField({ label, value, onChange, show, onToggle, hint, className, autoFocus }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={label === 'Current password' ? 'current-password' : 'new-password'}
          className={className}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-600"
          aria-label={show ? 'Hide passwords' : 'Show passwords'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}
