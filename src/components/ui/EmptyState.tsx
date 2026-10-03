import type { ReactNode } from 'react'
import { cls } from "../../lib/format"
import { Icon } from './Icon'
import type { IconName } from './Icon'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  icon?: IconName
  action?: ReactNode
  /** Compact variant for nested panels. */
  inline?: boolean
  className?: string
  /**
   * Element used for the title. Defaults to a paragraph, which is right for an
   * empty *panel*. A page-level empty state (the 404 view) must pass `"h1"` so
   * the page still has a heading — otherwise it has no accessible title at all.
   */
  titleAs?: 'p' | 'h1' | 'h2'
}

export function EmptyState({
  title,
  description,
  icon = 'search',
  action,
  inline = false,
  className,
  titleAs,
}: EmptyStateProps) {
  const Title = titleAs ?? 'p'
  return (
    <div
      role="status"
      className={cls(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line text-center',
        inline ? 'gap-1.5 px-4 py-8' : 'gap-2 px-6 py-14',
        className,
      )}
    >
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-surface-3 text-ink-faint">
        <Icon name={icon} size={inline ? 18 : 20} />
      </span>
      <Title className={cls('font-semibold text-ink', inline ? 'text-sm' : 'text-base')}>{title}</Title>
      {description ? <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
