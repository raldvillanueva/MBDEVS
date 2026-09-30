import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, RefreshCw, AlertTriangle, Plus, X, Users, Clock, Info, SlidersHorizontal, ListChecks, Filter } from 'lucide-react'
import SuperAdminLayout from './SuperAdminLayout'
import DropdownLists from '../DropdownLists'
import { FILTER_FIELDS } from '../../lib/recordFilters'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useSettings } from '../../lib/SettingsContext'

/**
 * System Settings, in two tabs:
 *
 *   General         crew names and overdue thresholds — Super Admin only
 *                   (app_settings is writable only by is_super_admin()).
 *   Dropdown Lists  the choices in the record forms — Admin and Super Admin
 *                   (dropdown_options is writable by can_edit_lists()).
 *
 * The Super Admin opens it from the Super Admin section; an Admin opens it
 * from the sector sidebar (inSectorApp), sees only the Dropdown Lists tab,
 * and never gets the Super Admin chrome around it.
 */
export default function SystemSettings({ inSectorApp = false }) {
  const { isSuperAdmin: isSuper, profile, role } = useAuth()
  // Same rule as SuperAdminRoute: an account from before account_type
  // existed with role admin is a Super Admin.
  const isSuperAdmin = isSuper || (profile?.account_type == null && role === 'admin')
  const [params, setParams] = useSearchParams()
  const tab = !isSuperAdmin || params.get('tab') === 'lists' ? 'lists' : 'general'

  const body = (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#2E2E2E]">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Values the whole system uses. Changing them here avoids a code change.
        </p>
      </div>

      {isSuperAdmin && (
        <div className="mb-6 flex gap-1 border-b border-[#D9D9D9]">
          {[
            { key: 'general', label: 'General', icon: SlidersHorizontal },
            { key: 'lists', label: 'Dropdown Lists', icon: ListChecks },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setParams(key === 'lists' ? { tab: 'lists' } : {}, { replace: true })}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === key ? 'border-[#D89B00] text-[#2E2E2E]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'lists' ? <DropdownLists embedded /> : <GeneralSettings />}
    </>
  )

  return inSectorApp ? body : <SuperAdminLayout>{body}</SuperAdminLayout>
}

function GeneralSettings() {
  const { session } = useAuth()
  // Saving refreshes the app-wide copy, so the crew dropdown and the overdue
  // tiles change on the next render rather than after a reload.
  const { reload: reloadAppSettings } = useSettings()
  const [crewNames, setCrewNames] = useState([])
  const [warningDays, setWarningDays] = useState(10)
  const [criticalDays, setCriticalDays] = useState(21)
  // Columns whose filter is switched off, everywhere, for everyone.
  const [filterOff, setFilterOff] = useState([])
  const [newCrew, setNewCrew] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // What the database currently holds. Adding a crew only changes the
  // list on screen, and the page looked identical either way — so it was
  // easy to add one, walk away, and never find out it was not saved.
  const [saved, setSaved] = useState(null)

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
    setFilterOff(Array.isArray(byKey.filter_disabled_columns) ? byKey.filter_disabled_columns : [])
    setSaved({
      crewNames: Array.isArray(byKey.crew_names) ? byKey.crew_names : [],
      warningDays: Number(byKey.overdue_warning_days ?? 10),
      criticalDays: Number(byKey.overdue_critical_days ?? 21),
      filterOff: Array.isArray(byKey.filter_disabled_columns) ? byKey.filter_disabled_columns : [],
    })
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
      { key: 'filter_disabled_columns', label: 'Column filters switched off', value: filterOff, ...stamp },
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

    // What is on screen is now what the database holds, so the unsaved
    // warning clears without needing a reload to find that out.
    setSaved({
      crewNames: [...crewNames],
      warningDays: Number(warningDays),
      criticalDays: Number(criticalDays),
      filterOff: [...filterOff],
    })

    await reloadAppSettings()
    setSaving(false)
    setNotice('Settings saved. Everyone else sees the change when they next load a page.')
  }

  // Order carries no meaning in either list, so a reorder is not a change.
  const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort())
  const dirty = !!saved && (
    !same(crewNames, saved.crewNames) ||
    !same(filterOff, saved.filterOff) ||
    Number(warningDays) !== saved.warningDays ||
    Number(criticalDays) !== saved.criticalDays
  )

  return (
    <>
      <div className="mb-4 flex max-w-2xl justify-end">
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

          {/* Column filters on / off */}
          <section className="overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#D9D9D9] px-5 py-4">
              <Filter size={18} className="text-[#D89B00]" />
              <h2 className="font-semibold text-[#2E2E2E]">Column Filters</h2>
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {FILTER_FIELDS.length - filterOff.length} of {FILTER_FIELDS.length} on
              </span>
              <div className="ml-auto flex gap-3 text-xs">
                <button onClick={() => setFilterOff([])} className="text-blue-600 hover:underline">All on</button>
                <button onClick={() => setFilterOff(FILTER_FIELDS.map(f => f.key))} className="text-slate-500 hover:underline">All off</button>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="mb-3 text-sm text-slate-500">
                Which columns can be filtered in Field Orders, Pending Records and Archived Work Orders.
                Switching one off removes its ▽ filter from the column header and from “+ Add filter”, for every account.
              </p>

              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {FILTER_FIELDS.map(f => {
                  const on = !filterOff.includes(f.key)
                  return (
                    <label key={f.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <span className={`text-sm ${on ? 'text-slate-700' : 'text-slate-400'}`}>{f.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => setFilterOff(on ? [...filterOff, f.key] : filterOff.filter(k => k !== f.key))}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#D89B00]' : 'bg-slate-300'}`}
                        title={on ? 'Filter on — click to switch off' : 'Filter off — click to switch on'}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </label>
                  )
                })}
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>
                  The search box still looks in every column, and no records change. A saved filter that used a
                  switched-off column simply skips that part until it is switched back on.
                </p>
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-[#D9D9D9] bg-[#F4F4F4] px-1 py-3">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex items-center gap-2 rounded-lg bg-[#D89B00] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C58A00] disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save settings'}
            </button>

            {dirty && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
                <AlertTriangle size={15} />
                Not saved yet
              </span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
