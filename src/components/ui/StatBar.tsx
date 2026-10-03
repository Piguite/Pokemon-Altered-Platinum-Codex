import { cls } from "../../lib/format"
import { STAT_MAX } from "../../lib/format"

export interface StatBarProps {
  value: number
  /** Denominator used to scale the bar. */
  max?: number
  tone?: 'base' | 'old' | 'new'
  className?: string
  label?: string
}

const TONE: Record<NonNullable<StatBarProps['tone']>, string> = {
  base: 'bg-info/70',
  old: 'bg-ink-faint/60',
  new: 'bg-accent',
}

/**
 * A single horizontal stat bar. Purely decorative (aria-hidden) — the numeric
 * value is always rendered next to it by the caller.
 */
export function StatBar({ value, max = STAT_MAX, tone = 'base', className, label }: StatBarProps) {
  const pct = Math.max(value > 0 ? 2 : 0, Math.min(100, (value / max) * 100))
  return (
    <div
      aria-hidden="true"
      className={cls('h-1.5 w-full overflow-hidden rounded-pill bg-surface-3', className)}
      title={label}
    >
      <div
        className={cls('h-full rounded-pill transition-[width] duration-500 ease-out', TONE[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
