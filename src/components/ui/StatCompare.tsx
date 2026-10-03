import type { StatBlock } from "../../types/data"
import { STAT_KEYS, STAT_LONG, STAT_SHORT, cls, signed, statTotal } from "../../lib/format"
import type { StatKey } from "../../lib/format"
import { StatBar } from './StatBar'

export type StatMode = 'all' | 'new' | 'old' | 'compare'

export interface StatCompareProps {
  old?: StatBlock
  new: StatBlock
  mode?: StatMode
  className?: string
  /** Highlights rows whose value changed. */
  highlightChanges?: boolean
}

interface Row {
  key: StatKey
  label: string
  long: string
  oldValue: number | null
  newValue: number
  delta: number
}

function buildRows(old: StatBlock | undefined, current: StatBlock): Row[] {
  return STAT_KEYS.map((key) => {
    const newValue = current[key]
    const oldValue = old ? old[key] : null
    return {
      key,
      label: STAT_SHORT[key],
      long: STAT_LONG[key],
      oldValue,
      newValue,
      delta: oldValue === null ? 0 : newValue - oldValue,
    }
  })
}

/**
 * Old-vs-new stat comparison.
 *
 * - `all`  : the current (altered) spread only
 * - `old`  : the vanilla spread only
 * - `new`  : alias of `all`, kept for the segmented control
 * - `compare`: both spreads, delta chips and a BST call-out
 */
export function StatCompare({ old, new: current, mode = 'all', className, highlightChanges = true }: StatCompareProps) {
  const rows = buildRows(old, current)
  const newTotal = current.bst || statTotal(current)
  const oldTotal = old ? old.bst || statTotal(old) : null
  const comparable = Boolean(old) && mode === 'compare'
  const totalDelta = oldTotal === null ? 0 : newTotal - oldTotal

  return (
    <div className={cls('space-y-2.5', className)}>
      <div className="space-y-2">
        {rows.map((row) => {
          const changed = comparable && row.delta !== 0
          const displayValue = mode === 'old' && row.oldValue !== null ? row.oldValue : row.newValue
          return (
            <div key={row.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[3.75rem_minmax(0,1fr)_3.5rem]">
              <span
                className={cls(
                  'font-mono text-[11px] font-semibold tracking-wide',
                  changed && highlightChanges ? 'text-ink' : 'text-ink-muted',
                )}
                title={row.long}
              >
                {row.label}
              </span>

              <div className="min-w-0 space-y-1">
                {comparable && row.oldValue !== null ? (
                  <>
                    <StatBar value={row.oldValue} tone="old" label={`${row.long} — vanilla: ${row.oldValue}`} />
                    <div className="flex items-center gap-2">
                      <StatBar value={row.newValue} tone="new" label={`${row.long} — Altered: ${row.newValue}`} />
                      <span className="nums shrink-0 font-mono text-xs font-semibold text-ink tabular-nums sm:hidden">
                        {row.newValue}
                      </span>
                    </div>
                  </>
                ) : (
                  <StatBar
                    value={displayValue}
                    tone={mode === 'old' ? 'old' : 'new'}
                    label={`${row.long}: ${displayValue}`}
                  />
                )}
              </div>

              <div className="col-start-2 flex items-center gap-2 sm:col-start-3 sm:justify-end">
                {comparable && row.oldValue !== null ? (
                  <>
                    <span className="nums font-mono text-xs text-ink-faint line-through">{row.oldValue}</span>
                    <span className="nums font-mono text-sm font-semibold text-ink">{row.newValue}</span>
                    <span
                      className={cls(
                        'nums font-mono text-[11px] font-semibold',
                        row.delta > 0 ? 'text-good' : row.delta < 0 ? 'text-bad' : 'text-ink-faint',
                      )}
                    >
                      {row.delta === 0 ? '±0' : signed(row.delta)}
                    </span>
                  </>
                ) : (
                  <span className="nums font-mono text-sm font-semibold text-ink">{displayValue}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-ink-muted" title="Base stat total">
          BST
        </span>
        <div className="flex items-center gap-2">
          {comparable && oldTotal !== null ? (
            <>
              <span className="nums font-mono text-xs text-ink-faint line-through">{oldTotal}</span>
              <span className="nums font-mono text-base font-bold text-ink">{newTotal}</span>
              <span
                className={cls(
                  'rounded-pill px-2 py-0.5 font-mono text-[11px] font-bold',
                  totalDelta > 0 ? 'bg-good/15 text-good' : totalDelta < 0 ? 'bg-bad/15 text-bad' : 'bg-surface-3 text-ink-faint',
                )}
              >
                {totalDelta === 0 ? 'unchanged' : `${signed(totalDelta)} BST`}
              </span>
            </>
          ) : (
            <span className="nums font-mono text-base font-bold text-ink">{mode === 'old' && oldTotal !== null ? oldTotal : newTotal}</span>
          )}
        </div>
      </div>
    </div>
  )
}
