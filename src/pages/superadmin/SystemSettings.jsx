import { useCallback, useEffect, useState } from 'react'
import { Save, RefreshCw, AlertTriangle, Plus, X, Users, Clock, Info } from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useSettings } from '../../lib/SettingsContext'

export default function SystemSettings() {
  const { session } = useAuth()
  // Saving refreshes the app-wide copy, so the crew dropdown and the overdue
  // tiles change on the next render rather than after a reload.
  const { reload: reloadAppSettings } = useSettings()
  const [crewNames, setCrewNames] = useState([])
  const [warningDays, setWarningDays] = useState(10)
  const [criticalDays, setCriticalDays] = useState(21)
  const [newCrew, setNewCrew] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.from('app_settings').select('key, value')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]))
    setCrewNames(Array.isArray(byKey.crew_names) ? byKey.crew_names : [])
    setWarningDays(Number(byKey.overdue_warning_days ?? 10))
    setCriticalDays(Number(byKey.overdue_critical_days ?? 21))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function addCrew() {
    const name = newCrew.trim().toUpperCase()
    if (!name) return
    if (crewNames.includes(name)) {
      setError(`${name} is already on the list.`)
      return
    }
    setError('')
    setCrewNames([...crewNames, name].sort())
    setNewCrew('')
  }

  function removeCrew(name) {
    setCrewNames(crewNames.filter(n => n !== name))
  }

  async function save() {
    setError('')
    setNotice('')

    if (criticalDays <= warningDays) {
      // Otherwise the "critical" band is empty and the two tiles on the
      // Dashboard would disagree with each other.
      setError('Critical days must be greater than warning days.')
      return
    }

    setSaving(true)

    const stamp = { updated_at: new Date().toISOString(), updated_by: session?.user?.id }

    // Upsert rather than update: an update against a key the seed never
    // created would report success while changing nothing.
    const { error: err } = await supabase.from('app_settings').upsert([
      { key: 'crew_names', label: 'Crew names', value: crewNames, ...stamp },
      { key: 'overdue_warning_days', label: 'Overdue warning (days)', value: warningDays, ...stamp },
      { key: 'overdue_critical_days', label: 'Overdue critical (days)', value: criticalDays, ...stamp },
    ], { onConflict: 'key' })

    if (err) {
      setSaving(false)
      setError(
        err.message.includes('policy') || err.message.includes('row-level')
          ? 'Only a Super Admin can change system settings.'
          : err.message,
      )
      return
    }

    await reloadAppSettings()
    setSaving(false)
    setNotice('Settings saved. Everyone else sees the change when they next load a page.')
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2E2E2E]">System Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Values the whole system uses. Changing them here avoids a code change.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Reload
        </button>
      </div>

      {error && (
        <div className="mb-4 flex max-w-2xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-4 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading settings…</p>
      ) : (
        <div className="max-w-2xl space-y-5">

          {/* Crew names */}
          <section className="overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#D9D9D9] px-5 py-4">
              <Users size={18} className="text-[#D89B00]" />
              <h2 className="font-semibold text-[#2E2E2E]">Crew Names</h2>
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {crewNames.length}
              </span>
            </div>

            <div className="px-5 py-4">
              <p className="mb-3 text-sm text-slate-500">
                These fill the Crew Name dropdown when encoding a record.
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {crewNames.length === 0 && (
                  <p className="text-sm text-slate-400">No crews yet.</p>
                )}
                {crewNames.map(name => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm text-slate-700"
                  >
                    {name}
                    <button
                      onClick={() => removeCrew(name)}
                      title={`Remove ${name}`}
                      className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCrew}
                  onChange={e => setNewCrew(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCrew() } }}
                  placeholder="e.g. R. SANTOS"
                  className="flex-1 rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D89B00]"
                />
                <button
                  onClick={addCrew}
                  className="flex items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <Plus size={15} />
                  Add
                </button>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>
                  Removing a crew only takes them off the dropdown. Records already
                  naming them keep that name — nothing is rewritten.
                </p>
              </div>
            </div>
          </section>

          {/* Overdue thresholds */}
          <section className="overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#D9D9D9] px-5 py-4">
              <Clock size={18} className="text-[#D89B00]" />
              <h2 className="font-semibold text-[#2E2E2E]">Overdue Thresholds</h2>
            </div>

            <div className="px-5 py-4">
              <p className="mb-4 text-sm text-slate-500">
                How many days after a job is executed, with the meter still not
                returned, before it counts as overdue. These drive the two
                Overdue tiles on the Dashboard.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Warning after
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={warningDays}
                      onChange={e => setWarningDays(Number(e.target.value))}
                      className="w-24 rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D89B00]"
                    />
                    <span className="text-sm text-slate-500">days</span>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Critical after
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={criticalDays}
                      onChange={e => setCriticalDays(Number(e.target.value))}
                      className="w-24 rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D89B00]"
                    />
                    <span className="text-sm text-slate-500">days</span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#D89B00] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </SuperAdminLayout>
  )
}
