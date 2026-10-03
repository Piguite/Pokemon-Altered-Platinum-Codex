import type { ReactNode } from 'react'
import { cls } from "../../lib/format"

export interface TabItem {
  id: string
  label: string
  count?: number
  icon?: ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  /** Accessible name for the tab list. */
  label: string
  size?: 'sm' | 'md'
}

/**
 * WAI-ARIA tab list with roving arrow-key navigation. The panels themselves are
 * rendered by the caller (each route keeps its own content).
 */
export function Tabs({ tabs, value, onChange, className, label, size = 'md' }: TabsProps) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === value)
    if (index < 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = tabs[(index + delta + tabs.length) % tabs.length]
      onChange(next.id)
      const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)
      el?.focus()
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onChange(tabs[0].id)
    }
    if (event.key === 'End') {
      event.preventDefault()
      onChange(tabs[tabs.length - 1].id)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cls('no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cls(
              'inline-flex shrink-0 items-center gap-1.5 rounded-pill border font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? 'border-transparent bg-accent-solid text-accent-ink'
                : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span
                className={cls(
                  'nums rounded-pill px-1.5 py-px font-mono text-[10px] font-semibold',
                  active ? 'bg-black/25 text-accent-ink' : 'bg-surface-3 text-ink-faint',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
