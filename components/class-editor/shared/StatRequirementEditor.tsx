import React from 'react'

const STAT_OPTIONS = ['STR','DEX','INT','CHA','LUK','FOR','CON'] as const

type Stat = typeof STAT_OPTIONS[number]

interface ReqEditorProps {
  req: any
  onChange: (next: any) => void
  onRemove?: () => void
}

export default function StatRequirementEditor({ req, onChange, onRemove }: ReqEditorProps) {
  const statOptions = (req.statOptions && Array.isArray(req.statOptions)) ? req.statOptions : (req.stat ? [String(req.stat).toUpperCase()] : [])

  const toggleStat = (s: Stat) => {
    const next = statOptions.includes(s) ? statOptions.filter((x:string)=>x!==s) : [...statOptions, s]
    onChange({ ...req, statOptions: next, stat: next[0]?.toLowerCase?.() || req.stat })
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-emerald-900/5 dark:bg-emerald-900/5 border border-emerald-200 dark:border-emerald-800 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-[12px] font-medium text-gray-700 dark:text-gray-200">Stats (choose one or more — highest will be used)</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {STAT_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStat(s)}
                className={`text-[11px] px-2 py-1 rounded border ${statOptions.includes(s) ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-emerald-300 dark:border-emerald-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[12px] text-gray-700 dark:text-gray-200 mr-2">Mode</div>
          <select value={req.mode || 'max'} onChange={e => onChange({ ...req, mode: e.target.value })} className="text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white">
            <option value="max">Highest / per</option>
            <option value="threshold_count">Count (≥ threshold)</option>
            <option value="per_stat">Per-stat divisors</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={req.template || ''}
          placeholder={`Template (use {n} to show computed value)`}
          onChange={e => onChange({ ...req, template: e.target.value })}
          className="flex-1 text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => {
            const preview = statOptions.length > 1 ? `${statOptions.join('/')} (highest)` : statOptions[0] || (req.stat || 'STAT')
            const tmpl = req.template || `You can use this skill an additional time for every {n} ${preview.toLowerCase()}.`
            onChange({ ...req, template: tmpl })
          }}
          className="text-sm px-3 py-1 bg-blue-600 text-white rounded shadow"
        >Auto-fill sentence</button>
      </div>

      {/* Mode-specific inputs */}
      {req.mode === 'max' && (
        <div className="text-xs text-gray-500">Per: <input type="number" min={1} value={req.divisor || 1} onChange={e => onChange({ ...req, divisor: Number(e.target.value) || 1 })} className="ml-2 w-20 text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white inline-block" /></div>
      )}

      {req.mode === 'threshold_count' && (
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-200">
          <div>Threshold:</div>
          <input type="number" min={0} value={req.threshold ?? 1} onChange={e => onChange({ ...req, threshold: Number(e.target.value) || 0 })} className="w-20 text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white" />
          <div className="text-[11px] text-gray-300 dark:text-gray-200">Count how many selected stats meet or exceed threshold</div>
        </div>
      )}

      {req.mode === 'per_stat' && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-400 dark:text-gray-200">Per-stat divisors (leave blank to use main Per)</div>
          <div className="flex gap-2 flex-wrap">
            {statOptions.map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className="text-[11px] w-8">{s}</div>
                <input type="number" min={1} value={(req.perStatDivisors && req.perStatDivisors[s]) || ''} onChange={e => {
                  const next = { ...(req.perStatDivisors || {}) }
                  if (e.target.value === '') delete next[s]
                  else next[s] = Number(e.target.value)
                  onChange({ ...req, perStatDivisors: next })
                }} className="w-16 text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white" />
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-200">Fallback Per: <input type="number" min={1} value={req.divisor || 1} onChange={e => onChange({ ...req, divisor: Number(e.target.value) || 1 })} className="ml-2 w-20 text-sm bg-white dark:bg-gray-700 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-gray-900 dark:text-white inline-block" /></div>
        </div>
      )}

      <div className="text-xs text-gray-600 dark:text-gray-300">Preview: <span className="font-medium text-gray-800 dark:text-gray-100">{req.template ? req.template.replace('{n}', 'n') : 'Pick stats and divisor, then click Auto-fill sentence'}</span></div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {req.mode === 'max' && `Using highest of selected stats to compute n = floor(max(stats)/per)`}
          {req.mode === 'threshold_count' && `Counting selected stats >= ${req.threshold ?? 1}`}
          {req.mode === 'per_stat' && `Using per-stat divisors; n = max(floor(stat/div)) across selected stats`}
        </div>
        <button type="button" onClick={onRemove} className="text-xs text-red-500">Remove</button>
      </div>
    </div>
  )
}
