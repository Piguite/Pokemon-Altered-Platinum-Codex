import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cls } from "../../lib/format"

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift + focus ring — use only when the whole card is a link. */
  interactive?: boolean
  padded?: boolean
}

export function Card({ interactive = false, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cls(
        'rounded-card border border-line bg-surface shadow-card',
        padded && 'p-4 sm:p-5',
        interactive &&
          'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface CardLinkProps extends Omit<HTMLAttributes<HTMLAnchorElement>, 'children'> {
  to: string
  children: ReactNode
  padded?: boolean
}

/** Card whose entire surface is a deep link. */
export function CardLink({ to, children, className, padded = true, ...rest }: CardLinkProps) {
  return (
    <Link
      to={to}
      className={cls(
        'group block rounded-card border border-line bg-surface shadow-card outline-none',
        'transition-[transform,border-color,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-line-strong focus-visible:-translate-y-0.5',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cls('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeTone = 'neutral' | 'accent' | 'info' | 'good' | 'bad' | 'warn' | 'outline' | 'form'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-ink-muted border-transparent',
  accent: 'bg-accent-solid text-accent-ink border-transparent',
  info: 'bg-info/15 text-info border-info/30',
  good: 'bg-good/15 text-good border-good/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  outline: 'bg-transparent text-ink-muted border-line-strong',
  /* Regional forms: violet in both themes, tuned per theme for AA on its 15% tint. */
  form: 'bg-form/15 text-form border-form/35',
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  title?: string
  mono?: boolean
}

export function Badge({ children, tone = 'neutral', className, title, mono = false }: BadgeProps) {
  return (
    <span
      title={title}
      className={cls(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] leading-5 font-medium whitespace-nowrap',
        mono && 'font-mono',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A `from → to` pair rendered as two chips with a directional arrow. */
export function ArrowPair({
  from,
  to,
  render,
  className,
}: {
  from: ReactNode
  to: ReactNode
  render?: (value: ReactNode, side: 'from' | 'to') => ReactNode
  className?: string
}) {
  return (
    <span className={cls('inline-flex flex-wrap items-center gap-1.5', className)}>
      {render ? render(from, 'from') : from}
      <span aria-hidden="true" className="text-ink-faint">
        →
      </span>
      <span className="sr-only">becomes</span>
      {render ? render(to, 'to') : to}
    </span>
  )
}

/** Signed numeric delta — the sign is textual, so colour is never the only cue. */
export function Delta({ value, className, suffix }: { value: number; className?: string; suffix?: string }) {
  const tone = value > 0 ? 'text-good' : value < 0 ? 'text-bad' : 'text-ink-faint'
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±'
  return (
    <span className={cls('nums font-mono text-xs font-semibold', tone, className)}>
      {sign}
      {Math.abs(value).toLocaleString('en-US')}
      {suffix}
    </span>
  )
}
