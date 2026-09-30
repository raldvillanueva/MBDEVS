import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronLeft } from 'lucide-react'
import { BLANK, OPS, filterField, opSpec, opsFor } from '../../lib/recordFilters'

const inputCls = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * A panel pinned under whatever opened it. position: fixed so it is not
 * clipped by the table's scroll containers. Closes on a click outside,
 * or Escape.
 */
export function FloatingPanel({ anchorRect, onClose, width = 280, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: anchorRect?.left ?? 0, top: (anchorRect?.bottom ?? 0) + 4 })

  // Keep the panel on screen when it opens near the right or bottom edge.
  useLayoutEffect(() => {
    if (!anchorRect || !ref.current) return
    const h = ref.current.offsetHeight
    const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8))
    let top = anchorRect.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchorRect.top - h - 4)
    setPos({ left, top })
  }, [anchorRect, width])

  useEffect(() => {
    function onDown(e) {
      if (ref.current?.contains(e.target)) return
      if (e.target.closest?.('[data-filter-anchor]')) return
      onClose()
    }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 1000 }}
      className="rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/**
 * Tick any number of values. options: [{ value, label?, count? }].
 * The blank option is always offered so "no job description yet" can be
 * found too.
 */
export function ValuePicker({ options, loading, selected, onApply, onCancel, applyLabel = 'Apply' }) {
  const [picked, setPicked] = useState(() => new Set(selected || []))
  const [q, setQ] = useState('')

  const all = useMemo(() => {
    const list = options || []
    return list.some(o => o.value === BLANK) ? list : [...list, { value: BLANK, label: '(Blank)' }]
  }, [options])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? all.filter(o => String(o.label ?? o.value).toLowerCase().includes(t)) : all
  }, [all, q])

  function toggle(v) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-slate-100 p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Find a value…"
            className={`${inputCls} pl-7`}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <button type="button" onClick={() => setPicked(new Set(shown.map(o => o.value)))} className="text-blue-600 hover:underline">
            Tick all{q ? ' shown' : ''}
          </button>
          <button type="button" onClick={() => setPicked(new Set())} className="text-slate-500 hover:underline">
            Untick all
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {loading && <p className="px-3 py-2 text-xs text-slate-400">Loading values…</p>}
        {!loading && shown.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No values match.</p>}
        {shown.map(o => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={picked.has(o.value)}
              onChange={() => toggle(o.value)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
            />
            <span className={`flex-1 truncate ${o.value === BLANK ? 'italic text-slate-400' : ''}`}>
              {o.value === BLANK ? '(Blank)' : (o.label ?? o.value)}
            </span>
            {o.notOnList && <span className="shrink-0 rounded bg-amber-50 px-1 text-[10px] text-amber-700" title="Used in records but not on the dropdown list">not on list</span>}
            {o.count != null && <span className="shrink-0 text-xs tabular-nums text-slate-400">{o.count.toLocaleString()}</span>}
          </label>
        ))}
      </div>

      <div className="flex gap-2 border-t border-slate-100 p-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply([...picked])}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {applyLabel}{picked.size ? ` (${picked.size})` : ''}
        </button>
      </div>
    </div>
  )
}

/** One condition: "<column> <is more than> <value>". */
export function RuleEditor({ rule, onApply, onCancel, onRemove }) {
  const field = filterField(rule.field)
  const [op, setOp] = useState(rule.op || OPS[field?.type || 'text'][0].op)
  const [value, setValue] = useState(rule.value ?? '')
  const [value2, setValue2] = useState(rule.value2 ?? '')
  const spec = opSpec(rule.field, op)
  const inputType = field?.type === 'date' ? 'date' : field?.type === 'number' || field?.type === 'aging' ? 'number' : 'text'
  const ready = spec && (spec.noValue || (String(value).trim() !== '' && (!spec.two || String(value2).trim() !== '')))

  function submit(e) {
    e?.preventDefault()
    if (!ready) return
    onApply({ ...rule, op, value: spec.noValue ? '' : value, value2: spec.two ? value2 : '' })
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field?.label}</p>
      <select value={op} onChange={e => setOp(e.target.value)} className={inputCls}>
        {opsFor(rule.field).map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {spec && !spec.noValue && (
        <div className="flex items-center gap-2">
          <input autoFocus type={inputType} value={value} onChange={e => setValue(e.target.value)} className={inputCls} />
          {spec.two && (
            <>
              <span className="text-xs text-slate-400">and</span>
              <input type={inputType} value={value2} onChange={e => setValue2(e.target.value)} className={inputCls} />
            </>
          )}
          {field?.type === 'aging' && <span className="text-xs text-slate-400">days</span>}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {onRemove ? (
          <button type="button" onClick={onRemove} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Remove
          </button>
        ) : (
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!ready}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </form>
  )
}

/** Choose which column to filter on. */
export function FieldPicker({ fields, onPick }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const shown = t ? fields.filter(f => f.label.toLowerCase().includes(t)) : fields
  const listFields = shown.filter(f => f.list)
  const other = shown.filter(f => !f.list)

  return (
    <div>
      <div className="border-b border-slate-100 p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by which column?" className={`${inputCls} pl-7`} />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {listFields.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Pick from values</p>}
        {listFields.map(f => (
          <button key={f.key} type="button" onClick={() => onPick(f)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">
            {f.label}
          </button>
        ))}
        {other.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Other columns</p>}
        {other.map(f => (
          <button key={f.key} type="button" onClick={() => onPick(f)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">
            {f.label}
          </button>
        ))}
        {shown.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No column matches.</p>}
      </div>
    </div>
  )
}

export function BackHeader({ label, onBack }) {
  return (
    <button type="button" onClick={onBack} className="flex w-full items-center gap-1 border-b border-slate-100 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
      <ChevronLeft size={13} /> {label}
    </button>
  )
}
