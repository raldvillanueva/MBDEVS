import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ListChecks, Plus, ArrowUp, ArrowDown, Pencil, EyeOff, Eye, Check, X, AlertTriangle, Info, History, MapPin, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDropdowns } from '../lib/DropdownContext'
import { DROPDOWN_FIELDS, dropdownFieldLabel, normalizeOption } from '../lib/dropdownLists'
import { DATA_SECTORS, SECTOR_LABELS } from '../lib/sectorTables'
import { AUDIT_ACTION_LABELS } from '../lib/auditLog'

function when(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function sectorText(sectors) {
  if (!sectors || sectors.length === 0) return 'All sectors'
  return sectors.map(s => SECTOR_LABELS[s] || s).join(', ')
}

function friendly(err) {
  const m = err?.message || ''
  if (m.includes('duplicate') || m.includes('unique')) return 'That value is already on this list (it may be hidden — check "Hidden values" below).'
  if (m.includes('row-level') || m.includes('policy') || err?.code === '42501') return 'Only an Admin or Super Admin can change the dropdown lists.'
  if (m.includes('Billed Amount')) return m
  return m || 'Something went wrong. Please try again.'
}

/** Pick sectors; none ticked = every sector. */
function SectorPicker({ value, onChange }) {
  const all = !value || value.length === 0
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${all ? 'bg-[#D89B00] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        All sectors
      </button>
      {DATA_SECTORS.map(s => {
        const on = !all && value.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => {
              const cur = all ? [] : value
              const next = on ? cur.filter(x => x !== s) : [...cur, s]
              onChange(next.length === 0 || next.length === DATA_SECTORS.length ? null : next)
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {SECTOR_LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Dropdown Lists — the choices in Job Description, Type of Meter, FO Type,
 * For Batch and Billed Amount. Admin and Super Admin can add, rename,
 * reorder, hide and limit to sectors; every change lands in the Audit Log
 * (written by the database, so it cannot be skipped).
 */
export default function DropdownLists({ embedded = false }) {
  const { byField, loading, tableMissing, reload } = useDropdowns()
  const [field, setField] = useState('job_description')
  const [newText, setNewText] = useState('')
  const [newSectors, setNewSectors] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [sectorEditId, setSectorEditId] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [changes, setChanges] = useState([])
  const [changesError, setChangesError] = useState('')

  const rows = useMemo(() => byField[field] || [], [byField, field])
  const active = rows.filter(r => r.active)
  const hidden = rows.filter(r => !r.active)
  const meta = DROPDOWN_FIELDS.find(f => f.key === field)

  const loadChanges = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('audit_logs')
      .select('*')
      .like('action', 'dropdown.%')
      .order('created_at', { ascending: false })
      .limit(25)
    if (err) setChangesError('Recent changes could not be loaded.')
    else { setChangesError(''); setChanges(data || []) }
  }, [])

  useEffect(() => { loadChanges() }, [loadChanges])

  async function after(message) {
    await reload()
    await loadChanges()
    setNotice(message)
  }

  function start() { setBusy(true); setError(''); setNotice('') }

  async function add(e) {
    e.preventDefault()
    const wanted = [...new Set(newText.split(/\r?\n/).map(normalizeOption).filter(Boolean))]
    if (wanted.length === 0) return
    const existing = new Map(rows.map(r => [normalizeOption(r.value), r]))
    const already = wanted.filter(v => existing.has(v))
    const fresh = wanted.filter(v => !existing.has(v))
    if (fresh.length === 0) {
      const hiddenOnes = already.filter(v => !existing.get(v).active)
      setError(hiddenOnes.length
        ? `${hiddenOnes.join(', ')} ${hiddenOnes.length > 1 ? 'are' : 'is'} already on the list but hidden — restore ${hiddenOnes.length > 1 ? 'them' : 'it'} under "Hidden values".`
        : `${already.join(', ')} ${already.length > 1 ? 'are' : 'is'} already on the list.`)
      return
    }
    start()
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0)
    const { error: err } = await supabase.from('dropdown_options').insert(
      fresh.map((value, i) => ({ field, value, sort_order: maxOrder + (i + 1) * 10, sectors: newSectors })),
    )
    setBusy(false)
    if (err) { setError(friendly(err)); return }
    setNewText('')
    await after(`Added ${fresh.length} value${fresh.length > 1 ? 's' : ''} to ${meta.label}.${already.length ? ` Skipped ${already.join(', ')} (already on the list).` : ''}`)
  }

  async function update(row, patch, message) {
    start()
    const { error: err } = await supabase.from('dropdown_options').update(patch).eq('id', row.id)
    setBusy(false)
    if (err) { setError(friendly(err)); return false }
    await after(message)
    return true
  }

  async function saveRename(row) {
    const v = normalizeOption(editText)
    if (!v || v === row.value) { setEditingId(null); return }
    if (rows.some(r => r.id !== row.id && normalizeOption(r.value) === v)) {
      setError(`${v} is already on this list.`)
      return
    }
    const ok = await update(row, { value: v }, `Renamed ${row.value} to ${v}. Records already saved as ${row.value} keep that value.`)
    if (ok) setEditingId(null)
  }

  async function move(index, dir) {
    const target = index + dir
    if (target < 0 || target >= active.length) return
    const order = [...active]
    ;[order[index], order[target]] = [order[target], order[index]]
    // Hidden values go after the visible ones so their position does not
    // interfere; renumbering keeps the gaps even after many moves.
    const all = [...order, ...hidden]
    const changed = all
      .map((r, i) => ({ r, sort_order: (i + 1) * 10 }))
      .filter(({ r, sort_order }) => r.sort_order !== sort_order)
    start()
    for (const { r, sort_order } of changed) {
      const { error: err } = await supabase.from('dropdown_options').update({ sort_order }).eq('id', r.id)
      if (err) { setBusy(false); setError(friendly(err)); await reload(); return }
    }
    setBusy(false)
    await reload()
  }

  if (tableMissing && !loading) {
    return (
      <div className="max-w-3xl">
        <Header onReload={reload} embedded={embedded} />
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            The dropdown lists are not set up on the database yet. Run
            <span className="font-mono"> dropdown_lists_and_filters_setup.sql </span>
            in the Supabase SQL Editor, then press Reload. Until then every form keeps using the built-in lists
            (including the 18 new Job Descriptions).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <Header onReload={() => { reload(); loadChanges() }} embedded={embedded} />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-700"><X size={15} /></button>
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">{notice}</p>
          <button onClick={() => setNotice('')} className="text-emerald-500 hover:text-emerald-800"><X size={15} /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
          {/* Which list */}
          <div className="flex flex-wrap gap-1 border-b border-[#D9D9D9] bg-slate-50 px-3 py-2">
            {DROPDOWN_FIELDS.map(f => {
              const n = (byField[f.key] || []).filter(r => r.active).length
              return (
                <button
                  key={f.key}
                  onClick={() => { setField(f.key); setEditingId(null); setSectorEditId(null); setError(''); setNotice('') }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${field === f.key ? 'bg-[#D89B00] text-white' : 'text-slate-600 hover:bg-white'}`}
                >
                  {f.label}
                  <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${field === f.key ? 'bg-white/25' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                </button>
              )
            })}
          </div>

          {/* Add */}
          <form onSubmit={add} className="space-y-2 border-b border-[#D9D9D9] px-5 py-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add to {meta.label}
            </label>
            <div className="flex gap-2">
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(e) } }}
                rows={newText.includes('\n') ? 4 : 1}
                placeholder={meta.numeric ? 'e.g. 450.75' : 'e.g. METER INSPECTION'}
                className="flex-1 resize-none rounded-lg border border-[#D9D9D9] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#D89B00]"
              />
              <button
                type="submit"
                disabled={busy || !newText.trim()}
                className="flex items-center gap-1.5 self-start rounded-lg bg-[#D89B00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C58A00] disabled:opacity-50"
              >
                <Plus size={15} /> Add
              </button>
            </div>
            {meta.freeText && (
              <p className="text-[11px] text-blue-700">
                These are suggestions shown while typing. The form still accepts any other name, so this list can start empty.
              </p>
            )}
            <p className="text-[11px] text-slate-400">Enter adds it. To add several at once, paste one per line (Shift+Enter for a new line). Saved in capitals.</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> Show in:</span>
              <SectorPicker value={newSectors} onChange={setNewSectors} />
            </div>
          </form>

          {/* Values */}
          <div className="divide-y divide-slate-100">
            {loading && <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>}
            {!loading && active.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">Nothing on this list yet.</p>}
            {active.map((row, i) => (
              <div key={row.id} className="px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-slate-300 hover:text-slate-700 disabled:opacity-30" title="Move up"><ArrowUp size={14} /></button>
                    <button disabled={busy || i === active.length - 1} onClick={() => move(i, 1)} className="text-slate-300 hover:text-slate-700 disabled:opacity-30" title="Move down"><ArrowDown size={14} /></button>
                  </div>

                  {editingId === row.id ? (
                    <form onSubmit={e => { e.preventDefault(); saveRename(row) }} className="flex flex-1 items-center gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 rounded-lg border border-[#D9D9D9] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#D89B00]"
                      />
                      <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700" title="Save"><Check size={14} /></button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" title="Cancel"><X size={14} /></button>
                    </form>
                  ) : (
                    <p className="flex-1 truncate text-sm font-medium text-slate-800">{row.value}</p>
                  )}

                  <button
                    onClick={() => setSectorEditId(sectorEditId === row.id ? null : row.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${row.sectors?.length ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    title="Which sectors show this value"
                  >
                    {sectorText(row.sectors)}
                  </button>

                  {editingId !== row.id && (
                    <button onClick={() => { setEditingId(row.id); setEditText(row.value); setSectorEditId(null) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Rename">
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => update(row, { active: false }, `Hidden ${row.value}. It no longer shows in dropdowns; records that already use it are unchanged and can still be filtered.`)}
                    className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                    title="Hide from dropdowns"
                  >
                    <EyeOff size={14} />
                  </button>
                </div>

                {sectorEditId === row.id && (
                  <div className="ml-7 mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="mb-1.5 text-xs text-slate-500">Show <strong>{row.value}</strong> in:</p>
                    <SectorPicker
                      value={row.sectors}
                      onChange={next => update(row, { sectors: next }, `${row.value} now shows in: ${sectorText(next)}.`)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Hidden */}
          {hidden.length > 0 && (
            <div className="border-t border-[#D9D9D9]">
              <button onClick={() => setShowHidden(!showHidden)} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-slate-500 hover:bg-slate-50">
                <EyeOff size={14} /> Hidden values ({hidden.length}) {showHidden ? '▲' : '▼'}
              </button>
              {showHidden && hidden.map(row => (
                <div key={row.id} className="flex items-center gap-3 border-t border-slate-100 px-5 py-2.5">
                  <p className="flex-1 truncate text-sm text-slate-400 line-through">{row.value}</p>
                  <button
                    disabled={busy}
                    onClick={() => update(row, { active: true }, `Restored ${row.value}.`)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Eye size={13} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 border-t border-[#D9D9D9] bg-blue-50 px-5 py-3 text-xs text-blue-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Nothing here rewrites records. Renaming or hiding a value only changes what the dropdowns offer —
              records already saved keep their value and can still be found with the filters. Values are never deleted,
              only hidden, so they can always be brought back.
            </p>
          </div>
        </section>

        {/* Recent changes */}
        <aside className="h-fit overflow-hidden rounded-2xl border border-[#D9D9D9] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#D9D9D9] px-4 py-3">
            <History size={16} className="text-[#D89B00]" />
            <h2 className="text-sm font-semibold text-[#2E2E2E]">Recent changes</h2>
          </div>
          <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {changesError && <p className="px-4 py-3 text-xs text-slate-400">{changesError}</p>}
            {!changesError && changes.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No changes yet.</p>}
            {changes.map(c => (
              <div key={c.id} className="px-4 py-2.5 text-xs">
                <p className="text-slate-700">
                  <span className="font-semibold">{c.actor_name || c.actor_email || 'Someone'}</span>{' '}
                  {changeText(c)}
                </p>
                <p className="mt-0.5 text-slate-400">{dropdownFieldLabel(c.details?.field)} · {when(c.created_at)}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            The Super Admin also sees these in Audit Logs.
          </p>
        </aside>
      </div>
    </div>
  )
}

function changeText(c) {
  const d = c.details || {}
  switch (c.action) {
    case 'dropdown.added':    return <>added <b>{d.value || c.target_label}</b>{d.sectors?.length ? ` (${sectorText(d.sectors)})` : ''}</>
    case 'dropdown.renamed':  return <>renamed <b>{d.old}</b> → <b>{d.new}</b></>
    case 'dropdown.hidden':   return <>hid <b>{d.value || c.target_label}</b></>
    case 'dropdown.restored': return <>restored <b>{d.value || c.target_label}</b></>
    case 'dropdown.sectors_changed': return <>set <b>{d.value || c.target_label}</b> to {sectorText(d.new)} (was {sectorText(d.old)})</>
    default: return AUDIT_ACTION_LABELS[c.action] || c.action
  }
}

function Header({ onReload, embedded }) {
  // Inside System Settings the page title is already there.
  if (embedded) {
    return (
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          The choices offered in the record forms and filters. Admin and Super Admin can change them; changes apply to everyone straight away.
        </p>
        <button onClick={onReload} className="flex shrink-0 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RefreshCw size={15} /> Reload
        </button>
      </div>
    )
  }
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#2E2E2E]">
          <ListChecks size={24} className="text-[#D89B00]" /> Dropdown Lists
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          The choices offered in the record forms and filters. Changes apply to everyone straight away.
        </p>
      </div>
      <button onClick={onReload} className="flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        <RefreshCw size={15} /> Reload
      </button>
    </div>
  )
}
