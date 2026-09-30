import { useCallback, useState } from 'react'
import { Search, SlidersHorizontal, Plus, X, ChevronDown } from 'lucide-react'
import {
  CLASSIC_SEARCH_FIELDS, MONTH_OPTIONS, activeFilterCount, describeRule, describeValues,
  fieldsForPage, filterField, ruleIsComplete, searchableFields,
} from '../../lib/recordFilters'
import { FloatingPanel, ValuePicker, RuleEditor, FieldPicker, BackHeader } from './FilterControls'
import SavedFiltersMenu from './SavedFiltersMenu'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => String(CURRENT_YEAR + 1 - i))

const newId = () => Math.random().toString(36).slice(2, 10)

/**
 * Search box, "Search in", "+ Add filter", saved filters and the chips for
 * every filter that is on. The page owns the filters object; this only
 * edits it (see lib/recordFilters.js for its shape).
 */
export default function FilterBar({
  page, sector, filters, onChange, getOptions,
  showPeriod = false, placeholder = 'Search…', rightSlot = null,
  // missing: columns the table does not have yet (not searchable either).
  // disabled: columns the Super Admin switched filtering off for.
  missing = [], disabled = [],
}) {
  const [panel, setPanel] = useState(null)
  const [options, setOptions] = useState({ loading: false, list: [] })
  const close = useCallback(() => setPanel(null), [])

  const textFields = searchableFields(page).filter(f => !missing.includes(f.key))
  const hidden = [...missing, ...disabled]
  const searchIn = filters.searchIn || []
  const scopeLabel =
    searchIn.length === 0 ? 'All columns'
    : searchIn.length === 1 ? filterField(searchIn[0])?.label
    : `${searchIn.length} columns`

  const set = patch => onChange({ ...filters, ...patch })

  const anchor = e => e.currentTarget.getBoundingClientRect()

  async function openValues(fieldKey, rect) {
    setPanel({ kind: 'values', fieldKey, anchorRect: rect })
    setOptions({ loading: true, list: [] })
    try {
      const list = await getOptions(fieldKey)
      setOptions({ loading: false, list })
    } catch {
      setOptions({ loading: false, list: [] })
    }
  }

  function applyValues(fieldKey, picked) {
    const values = { ...(filters.values || {}) }
    if (picked.length) values[fieldKey] = picked
    else delete values[fieldKey]
    set({ values })
    close()
  }

  function applyRule(rule) {
    const rules = [...(filters.rules || [])]
    const i = rules.findIndex(r => r.id === rule.id)
    if (i >= 0) rules[i] = rule
    else rules.push(rule)
    set({ rules })
    close()
  }

  function removeRule(id) {
    set({ rules: (filters.rules || []).filter(r => r.id !== id) })
    close()
  }

  const valueEntries = Object.entries(filters.values || {}).filter(([k, v]) => v?.length && !hidden.includes(k))
  const rules = (filters.rules || []).filter(r => ruleIsComplete(r) && !hidden.includes(r.field))
  const count = activeFilterCount(filters)

  return (
    <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search + where to look */}
        <div className="flex min-w-[280px] flex-1 items-stretch rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={e => set({ search: e.target.value })}
              placeholder={placeholder}
              className="w-full rounded-l-lg py-2 pl-9 pr-3 text-sm focus:outline-none"
            />
          </div>
          <button
            type="button"
            data-filter-anchor
            onClick={e => (panel?.kind === 'searchIn' ? close() : setPanel({ kind: 'searchIn', anchorRect: anchor(e) }))}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-r-lg border-l border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 hover:bg-slate-100"
            title="Choose which columns the search looks in"
          >
            in: <span className="font-semibold">{scopeLabel}</span>
            <ChevronDown size={12} />
          </button>
        </div>

        {showPeriod && (
          <>
            <select
              value={filters.year || 'All'}
              onChange={e => set({ year: e.target.value, month: e.target.value === 'All' ? 'All' : filters.month })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All years</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filters.month || 'All'}
              onChange={e => set({ month: e.target.value })}
              disabled={!filters.year || filters.year === 'All'}
              title={!filters.year || filters.year === 'All' ? 'Pick a year first' : 'Filter by month'}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="All">All months</option>
              {MONTH_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </>
        )}

        <button
          type="button"
          data-filter-anchor
          onClick={e => (panel?.kind === 'add' ? close() : setPanel({ kind: 'add', anchorRect: anchor(e) }))}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus size={15} />
          Add filter
        </button>

        <SavedFiltersMenu page={page} sector={sector} filters={filters} onApply={onChange} />

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ search: '', searchIn: filters.searchIn || [], values: {}, rules: [], year: 'All', month: 'All' })}
            className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Clear all
          </button>
        )}

        {rightSlot}
      </div>

      {(valueEntries.length > 0 || rules.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-slate-400" />
          {valueEntries.map(([col, picked]) => (
            <Chip
              key={col}
              label={describeValues(col, picked)}
              onClick={e => openValues(col, anchor(e))}
              onRemove={() => applyValues(col, [])}
            />
          ))}
          {rules.map(rule => (
            <Chip
              key={rule.id}
              label={describeRule(rule)}
              onClick={e => setPanel({ kind: 'rule', rule, anchorRect: anchor(e) })}
              onRemove={() => removeRule(rule.id)}
            />
          ))}
        </div>
      )}

      {panel?.kind === 'searchIn' && (
        <FloatingPanel anchorRect={panel.anchorRect} onClose={close} width={260}>
          <div className="border-b border-slate-100 p-2 text-xs">
            <p className="mb-1.5 font-semibold uppercase tracking-wide text-slate-500">Search looks in</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => set({ searchIn: [] })} className="text-blue-600 hover:underline">All columns</button>
              <button type="button" onClick={() => set({ searchIn: CLASSIC_SEARCH_FIELDS.filter(k => textFields.some(f => f.key === k)) })} className="text-blue-600 hover:underline">
                The usual 6
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {textFields.map(f => {
              const on = searchIn.length === 0 ? !f.notByDefault : searchIn.includes(f.key)
              return (
                <label key={f.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const current = searchIn.length === 0 ? textFields.filter(x => !x.notByDefault).map(x => x.key) : searchIn
                      const next = on ? current.filter(k => k !== f.key) : [...current, f.key]
                      // Everything ticked is the same as "all" — store it that
                      // way so a column added later is searched too.
                      set({ searchIn: next.length === textFields.length ? [] : next.length === 0 ? [f.key] : next })
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                  />
                  {f.label}
                </label>
              )
            })}
          </div>
        </FloatingPanel>
      )}

      {panel?.kind === 'add' && (
        <FloatingPanel anchorRect={panel.anchorRect} onClose={close} width={280}>
          {!panel.field ? (
            <FieldPicker
              fields={fieldsForPage(page).filter(f => !hidden.includes(f.key))}
              onPick={f => {
                if (f.list) {
                  setPanel({ ...panel, field: f })
                  setOptions({ loading: true, list: [] })
                  getOptions(f.key).then(list => setOptions({ loading: false, list })).catch(() => setOptions({ loading: false, list: [] }))
                } else {
                  setPanel({ ...panel, field: f, rule: { id: newId(), field: f.key, op: '' } })
                }
              }}
            />
          ) : panel.field.list ? (
            <>
              <BackHeader label={panel.field.label} onBack={() => setPanel({ ...panel, field: null })} />
              <ValuePicker
                key={panel.field.key}
                options={options.list}
                loading={options.loading}
                selected={filters.values?.[panel.field.key] || []}
                onApply={picked => applyValues(panel.field.key, picked)}
                onCancel={close}
              />
            </>
          ) : (
            <>
              <BackHeader label="Pick another column" onBack={() => setPanel({ ...panel, field: null, rule: null })} />
              <RuleEditor rule={panel.rule} onApply={applyRule} onCancel={close} />
            </>
          )}
        </FloatingPanel>
      )}

      {panel?.kind === 'values' && (
        <FloatingPanel anchorRect={panel.anchorRect} onClose={close} width={280}>
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {filterField(panel.fieldKey)?.label}
          </p>
          <ValuePicker
            key={panel.fieldKey}
            options={options.list}
            loading={options.loading}
            selected={filters.values?.[panel.fieldKey] || []}
            onApply={picked => applyValues(panel.fieldKey, picked)}
            onCancel={close}
          />
        </FloatingPanel>
      )}

      {panel?.kind === 'rule' && (
        <FloatingPanel anchorRect={panel.anchorRect} onClose={close} width={300}>
          <RuleEditor key={panel.rule.id} rule={panel.rule} onApply={applyRule} onRemove={() => removeRule(panel.rule.id)} />
        </FloatingPanel>
      )}
    </div>
  )
}

function Chip({ label, onClick, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50 text-xs text-blue-800">
      <button type="button" data-filter-anchor onClick={onClick} className="truncate py-1 pl-2.5 pr-1 hover:underline" title="Change this filter">
        {label}
      </button>
      <button type="button" onClick={onRemove} className="rounded-full p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700" title="Remove this filter">
        <X size={12} />
      </button>
    </span>
  )
}
