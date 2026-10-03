import type { ReactNode } from 'react'
import { cls } from "../../lib/format"
import { Icon } from './Icon'
import type { IconName } from './Icon'

export interface SectionHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: IconName
  /** Right-aligned controls (filters, counts, links). */
  action?: ReactNode
  /** Small uppercase chip displayed above the title (e.g. a category). */
  eyebrow?: ReactNode
  level?: 'h2' | 'h3'
  id?: string
  className?: string
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  eyebrow,
  level = 'h2',
  id,
  className,
}: SectionHeaderProps) {
  const Tag = level
  return (
    <div className={cls('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>
        ) : null}
        <Tag id={id} className="flex items-center gap-2 text-base font-bold tracking-tight text-ink sm:text-lg">
          {icon ? <Icon name={icon} size={17} className="shrink-0 text-ink-faint" /> : null}
          <span className="truncate">{title}</span>
        </Tag>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}

/** Page-level header used at the top of every route. */
export function PageHeader({
  title,
  subtitle,
  meta,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={cls('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">{subtitle}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  )
}
