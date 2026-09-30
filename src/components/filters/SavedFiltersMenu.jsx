import { useCallback, useEffect, useState } from 'react'
import { Bookmark, ChevronDown, Share2, Trash2, Users, Lock, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { SECTOR_LABELS } from '../../lib/sectorTables'
import { activeFilterCount, describeRule, describeValues, normalizeFilters, ruleIsComplete } from '../../lib/recordFilters'
import { FloatingPanel } from './FilterControls'

function summary(config) {
  const f = normalizeFilters(config)
  const parts = []
  if (f.search.trim()) parts.push(`“${f.search.trim()}”`)
  for (const [col, v] of Object.entries(f.values)) parts.push(describeValues(col, v))
  for (const r of f.rules.filter(ruleIsComplete)) parts.push(describeRule(r))
  if (f.year !== 'All') parts.push(f.month !== 'All' ? `${f.month} ${f.year}` : f.year)
  return parts.join(' · ') || 'No filters'
}

/**
 * Named filter sets for this sector and page.
 *   - Everyone can save their own; they are private.
 *   - Admin / Super Admin can share one with everybody in the sector, and
 *     tidy up shared ones.
 */
export default function SavedFiltersMenu({ page, sector, filters, onApply }) {
  const { session, canDelete: canShare } = useAuth()
  const me = session?.user?.id
  const [open, setOpen] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [name, setName] = useState('')
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('saved_filters')
      .select('*')
      .eq('sector', sector)
      .eq('page', page)
      .order('name')
    setLoading(false)
    if (err) { setUnavailable(true); setItems([]); return }
    setUnavailable(false)
    setItems(data || [])
  }, [sector, page])

  useEffect(() => { if (open) load() }, [open, load])

  const close = useCallback(() => { setOpen(null); setError(''); setName(''); setShare(false) }, [])

  async function save(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError('')
    const config = normalizeFilters(filters)
    const mine = items.find(i => i.owner_id === me && i.name.toLowerCase() === n.toLowerCase())
    const { error: err } = mine
      ? await supabase.from('saved_filters').update({ config, shared: canShare ? share : mine.shared }).eq('id', mine.id)
      : await supabase.from('saved_filters').insert({ sector, page, name: n, config, shared: canShare && share })
    setBusy(false)
    if (err) { setError(err.message); return }
    setName('')
    setShare(false)
    load()
  }

  async function update(item, patch) {
    setError('')
    const { error: err } = await supabase.from('saved_filters').update(patch).eq('id', item.id)
    if (err) setError(err.message)
    load()
  }

  async function remove(item) {
    if (!window.confirm(`Delete the saved filter “${item.name}”?`)) return
    setError('')
    const { error: err } = await supabase.from('saved_filters').delete().eq('id', item.id)
    if (err) setError(err.message)
    load()
  }

  const mine = items.filter(i => i.owner_id === me)
  const shared = items.filter(i => i.owner_id !== me && i.shared)
  const hasFilters = activeFilterCount(filters) > 0

  function renderRow(item) {
    const isMine = item.owner_id === me
    return (
      <div key={item.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-slate-50">
        <button type="button" onClick={() => { onApply(normalizeFilters(item.config)); close() }} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
            {item.shared ? <Users size={12} className="shrink-0 text-emerald-600" /> : <Lock size={12} className="shrink-0 text-slate-400" />}
            {item.name}
          </p>
          <p className="truncate text-xs text-slate-400">{summary(item.config)}</p>
          {!isMine && <p className="text-[11px] text-slate-400">by {item.owner_name || 'someone'}</p>}
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100">
          {isMine && (
            <button type="button" title="Replace with the filters on screen now" onClick={() => update(item, { config: normalizeFilters(filters) })} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <RefreshCw size={13} />
            </button>
          )}
          {canShare && (isMine || item.shared) && (
            <button
              type="button"
              title={item.shared ? 'Stop sharing' : `Share with everyone in ${SECTOR_LABELS[sector] || sector}`}
              onClick={() => update(item, { shared: !item.shared })}
              className={`rounded p-1 hover:bg-slate-200 ${item.shared ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'}`}
            >
              <Share2 size={13} />
            </button>
          )}
          {(isMine || (canShare && item.shared)) && (
            <button type="button" title="Delete" onClick={() => remove(item)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        data-filter-anchor
        onClick={e => (open ? close() : setOpen({ anchorRect: e.currentTarget.getBoundingClientRect() }))}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <Bookmark size={15} />
        Saved
        <ChevronDown size={13} />
      </button>

      {open && (
        <FloatingPanel anchorRect={open.anchorRect} onClose={close} width={340}>
          {unavailable ? (
            <p className="p-3 text-sm text-slate-500">
              Saved filters are not set up on the database yet. Ask whoever manages Supabase to run
              <span className="font-mono text-xs"> dropdown_lists_and_filters_setup.sql</span>.
            </p>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto">
                {loading && <p className="px-3 py-2 text-xs text-slate-400">Loading…</p>}
                {!loading && items.length === 0 && (
                  <p className="px-3 py-3 text-xs text-slate-400">No saved filters for {SECTOR_LABELS[sector] || sector} yet.</p>
                )}
                {mine.length > 0 && <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">My filters</p>}
                {mine.map(renderRow)}
                {shared.length > 0 && (
                  <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Shared in {SECTOR_LABELS[sector] || sector}
                  </p>
                )}
                {shared.map(renderRow)}
              </div>

              <form onSubmit={save} className="space-y-2 border-t border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-600">Save the filters on screen</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={60}
                  placeholder={hasFilters ? 'Name, e.g. Overdue reconnections' : 'Set some filters first'}
                  disabled={!hasFilters}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
                {canShare && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
                    Share with everyone in {SECTOR_LABELS[sector] || sector}
                  </label>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!hasFilters || !name.trim() || busy}
                  className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save filter'}
                </button>
                <p className="text-[11px] text-slate-400">Only you see it{canShare ? ' unless you share it' : ''}. It stays with {SECTOR_LABELS[sector] || sector}.</p>
              </form>
            </>
          )}
        </FloatingPanel>
      )}
    </>
  )
}
