import { useState } from 'react'
import {
  X,
  ShieldCheck,
  ClipboardList,
  Eye,
  ChevronLeft,
  Wand2,
  EyeOff,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { SECTOR_LABELS, DATA_SECTORS } from '../lib/sectorTables'
import { supabase } from '../lib/supabase'

// The four account kinds a Super Admin can hand out from this modal.
// Super Admin accounts themselves are never created here — that's a
// separate, more locked-down flow, not something spun up from a picker.
const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    description: 'Full access to records, reports, and their own Encoder/Viewer team.',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'encoder',
    label: 'Encoder',
    icon: ClipboardList,
    description: 'Encodes field data and edits their own submitted records.',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    icon: Eye,
    description: 'Read-only access to records and reports. No editing rights.',
    badgeClass: 'bg-slate-200 text-slate-700',
  },
]

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  contactNumber: '',
  sector: '',
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function CreateAccountModal({ open, onClose, onCreated }) {
  const [step, setStep] = useState('role') // 'role' | 'details' | 'done'
  const [role, setRole] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  function reset() {
    setStep('role')
    setRole(null)
    setForm(initialForm)
    setShowPassword(false)
    setError('')
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  function pickRole(value) {
    setRole(value)
    setStep('details')
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in name, email, and a password.')
      return
    }
    if (form.password.length < 8) {
      setError('Password should be at least 8 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords don\u2019t match.')
      return
    }

    setSubmitting(true)

    // The service key needed to create a sign-in can never live in a
    // browser, so this goes through the admin-users function, which checks
    // server-side that the caller really is a Super Admin.
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    if (!token) {
      setSubmitting(false)
      setError('Your session has expired. Sign in again and retry.')
      return
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            full_name: form.fullName.trim(),
            account_type: role,
          }),
        },
      )

      const result = await response.json()
      setSubmitting(false)

      if (!response.ok) {
        setError(result.error || 'Could not create the account.')
        return
      }

      setStep('done')
      onCreated?.(result)
    } catch {
      setSubmitting(false)
      setError('Could not reach the server. Check your connection and retry.')
    }
  }

  const activeRole = ROLE_OPTIONS.find((r) => r.value === role)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-6 py-4">
          <div className="flex items-center gap-2">
            {step === 'details' && (
              <button
                onClick={() => setStep('role')}
                className="mr-1 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Back"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h2 className="font-semibold text-[#2E2E2E]">
              {step === 'role' && 'Create Account \u2014 Choose a Role'}
              {step === 'details' && `Create ${activeRole?.label} Account`}
              {step === 'done' && 'Account Ready to Create'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1: role picker */}
        {step === 'role' && (
          <div className="px-6 py-5">
            <p className="mb-4 text-sm text-slate-500">
              What kind of account will this be? This decides what the person will be
              able to see and do once they sign in.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map(({ value, label, icon: Icon, description, badgeClass }) => (
                <button
                  key={value}
                  onClick={() => pickRole(value)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-[#D9D9D9] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#D89B00] hover:shadow-md"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${badgeClass}`}>
                    <Icon size={18} />
                  </span>
                  <span className="font-semibold text-[#2E2E2E]">{label}</span>
                  <span className="text-xs leading-snug text-slate-500">{description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: account details */}
        {step === 'details' && (
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              <Info size={16} className="shrink-0" />
              <span>
                This creates a real sign-in straight away — no confirmation email to
                wait for. Write the password down before you submit; it is not shown again.
              </span>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Role</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${activeRole?.badgeClass}`}>
                {activeRole?.label}
              </span>
              <button
                type="button"
                onClick={() => setStep('role')}
                className="text-xs font-medium text-[#D89B00] hover:underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Email (used to sign in)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="name@mbdevs.com"
                  className="w-full rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Temporary Password
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-[#D9D9D9] pr-1 focus-within:border-[#D89B00] focus-within:ring-1 focus-within:ring-[#D89B00]">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="rounded p-1.5 text-slate-400 hover:text-slate-600"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pw = generatePassword()
                      setForm((f) => ({ ...f, password: pw, confirmPassword: pw }))
                      setShowPassword(true)
                    }}
                    className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#D89B00] hover:underline"
                  >
                    <Wand2 size={12} />
                    Generate one
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Contact Number <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.contactNumber}
                    onChange={(e) => updateField('contactNumber', e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Assigned Sector <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    value={form.sector}
                    onChange={(e) => updateField('sector', e.target.value)}
                    className="w-full rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm outline-none focus:border-[#D89B00] focus:ring-1 focus:ring-[#D89B00]"
                  >
                    <option value="">No specific sector</option>
                    {DATA_SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {SECTOR_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
              >
                {submitting ? 'Creating\u2026' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: confirmation */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 size={40} className="text-emerald-500" />
            <p className="font-semibold text-[#2E2E2E]">Account created</p>
            <p className="max-w-sm text-sm text-slate-500">
              <strong>{form.fullName || form.email}</strong> can sign in now as a{' '}
              {activeRole?.label.toLowerCase()}, using the email and password you set.
              They appear in the list below straight away.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#C58A00]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
