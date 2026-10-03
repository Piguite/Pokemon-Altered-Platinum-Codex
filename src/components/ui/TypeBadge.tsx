import type { ReactNode } from 'react'
import { cls } from "../../lib/format"
import { readableInk, typeColor } from "../../lib/typechart"
import { typeDiff } from "../../lib/typechange"
import { Badge } from "./Card"

export interface TypeBadgeProps {
  type: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  /** Adds a leading colour dot for very small sizes where the label alone carries meaning. */
  withDot?: boolean
}

const SIZE_CLASSES = {
  xs: 'px-1.5 py-[1px] text-[11px] leading-4 rounded',
  sm: 'px-2 py-0.5 text-xs leading-5 rounded-md',
  md: 'px-2.5 py-1 text-[13px] leading-5 rounded-md',
  lg: 'px-3.5 py-1.5 text-[15px] leading-6 rounded-lg',
} as const

/**
 * Authentic per-type colour chip. The label is always rendered, so meaning is
 * never carried by colour alone (WCAG 1.4.1).
 */
export function TypeBadge({ type, size = 'sm', className, withDot = false }: TypeBadgeProps) {
  const bg = typeColor(type)
  const ink = readableInk(bg)
  return (
    <span
      className={cls(
        'inline-flex items-center gap-1 font-semibold tracking-wide whitespace-nowrap',
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: bg, color: ink }}
      title={`Type ${type}`}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ backgroundColor: ink, opacity: 0.75 }}
        />
      ) : null}
      {type}
    </span>
  )
}

export function TypeList({
  types,
  size = 'sm',
  className,
}: {
  types: string[]
  size?: TypeBadgeProps['size']
  className?: string
}) {
  if (types.length === 0) return <span className="text-xs text-ink-faint">—</span>
  return (
    <span className={cls('inline-flex flex-wrap items-center gap-1', className)}>
      {types.map((t) => (
        <TypeBadge key={t} type={t} size={size} />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Type change                                                         */
/* ------------------------------------------------------------------ */

/**
 * The explicit "Type change" tag.
 *
 * A real `Badge`, so it sits alongside the change-kind badges on a list card,
 * and is re-used wherever a documented old → new pair is the headline.
 */
export function TypeChangeTag({ className }: { className?: string }) {
  return (
    <Badge
      tone="info"
      className={className}
      title="The Pokémon's types changed in Altered Platinum"
    >
      Type change
    </Badge>
  )
}

/** Tiny side caption that makes a partial retype unambiguous. */
function SideCaption({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="text-[10px] leading-4 font-semibold tracking-[0.08em] text-ink-faint uppercase"
    >
      {children}
    </span>
  )
}

export interface TypeTransitionProps {
  oldTypes: string[]
  newTypes: string[]
  size?: TypeBadgeProps['size']
  className?: string
  /**
   * Show the `was` / `now` captions.
   *
   * `Normal → Normal · Fighting` is a *partial* retype — the base type is kept
   * and one is added — and without the captions the repeated type reads like a
   * rendering bug. The captions cost a few pixels and are used everywhere the
   * change is a headline.
   */
  sideLabels?: boolean
  /**
   * A node rendered as the first item of the indicator's own wrapping flow —
   * typically `<TypeChangeTag />`. Placed inside the flow (rather than beside
   * it) the tag shares the first line with `was …` instead of adding a line of
   * its own, which matters at card size.
   */
  leading?: ReactNode
}

/** `was Fire / Flying → now Fire · +Dragon`, with the losing types struck through. */
export function TypeTransition({
  oldTypes,
  newTypes,
  size = 'sm',
  className,
  sideLabels = false,
  leading,
}: TypeTransitionProps) {
  const diff = typeDiff(oldTypes, newTypes)
  const lost = new Set(diff.lost)
  const gained = new Set(diff.gained)
  const plus = size === 'xs' ? 'text-[12px]' : 'text-sm'

  /* One readable sentence for assistive tech; the chips below are decorative. */
  const summary = [
    `Types change from ${oldTypes.join(' / ') || 'none'} to ${newTypes.join(' / ') || 'none'}.`,
    diff.gained.length > 0 ? `Gained: ${diff.gained.join(', ')}.` : '',
    diff.lost.length > 0 ? `Lost: ${diff.lost.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={cls('inline-flex min-w-0 flex-col', className)}>
      <span className="sr-only">{summary}</span>
      <span
        data-type-transition=""
        aria-hidden="true"
        className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
      >
        {leading}
        <span data-side="old" className="inline-flex flex-wrap items-center gap-x-1">
          {sideLabels ? <SideCaption>was</SideCaption> : null}
          {oldTypes.map((type) =>
            lost.has(type) ? (
              <span key={`o-${type}`} data-diff="lost" className="inline-flex items-center">
                <TypeBadge type={type} size={size} className="line-through opacity-55" />
              </span>
            ) : (
              <span key={`o-${type}`} data-diff="kept" className="inline-flex items-center opacity-75">
                <TypeBadge type={type} size={size} />
              </span>
            ),
          )}
        </span>
        {/* The arrow travels with the new side, so a wrapped row still reads
            "was …" then "→ now …" instead of splitting mid-list. */}
        <span data-side="new" className="inline-flex flex-wrap items-center gap-x-1">
          <span className="text-ink-faint">→</span>
          {sideLabels ? <SideCaption>now</SideCaption> : null}
          {newTypes.map((type) =>
            gained.has(type) ? (
              <span key={`n-${type}`} data-diff="gained" className="inline-flex items-center gap-0.5">
                <span className={cls('font-mono font-bold text-good', plus)}>+</span>
                <TypeBadge type={type} size={size} className="font-extrabold" />
              </span>
            ) : (
              <span key={`n-${type}`} data-diff="kept" className="inline-flex items-center">
                <TypeBadge type={type} size={size} />
              </span>
            ),
          )}
        </span>
      </span>
    </span>
  )
}
