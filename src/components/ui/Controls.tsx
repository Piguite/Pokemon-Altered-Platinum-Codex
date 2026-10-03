import type { ChangeEvent, ReactNode } from 'react'
import { useId } from 'react'
import { cls } from "../../lib/format"
import { Icon } from './Icon'
import type { IconName } from './Icon'

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: IconName
  title?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cls('inline-flex max-w-full rounded-pill border border-line bg-surface-2 p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cls(
              'inline-flex items-center gap-1.5 rounded-pill font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
              active ? 'bg-accent-solid text-accent-ink shadow-card' : 'text-ink-muted hover:text-ink',
            )}
          >
            {/*
              The icon is decorative reinforcement only: dropping it below `sm`
              keeps a three-segment control inside a 320 px viewport without
              shrinking the labels or turning the group into a scroll rail.
            */}
            {option.icon ? <Icon name={option.icon} size={14} className="hidden shrink-0 sm:block" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

export interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  className?: string
  /** Renders the ⌘K hint when used as the header's palette trigger. */
  hint?: ReactNode
  autoFocus?: boolean
  onClear?: () => void
  size?: 'sm' | 'md'
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  label,
  className,
  hint,
  autoFocus = false,
  onClear,
  size = 'md',
}: SearchFieldProps) {
  const id = useId()
  return (
    <div className={cls('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        name="search"
        size={size === 'sm' ? 15 : 16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
      />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cls(
          'w-full rounded-pill border border-line bg-surface-2 pr-16 text-ink placeholder:text-ink-faint',
          'transition-colors focus:border-line-strong focus:bg-surface focus:outline-none',
          size === 'sm' ? 'py-1.5 pl-9 text-xs' : 'py-2 pl-9.5 text-sm',
        )}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-ink-faint hover:text-ink"
        >
          <Icon name="close" size={14} />
        </button>
      ) : hint ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 hidden items-center gap-1 rounded border border-line bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:flex">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export interface SelectFieldProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}

export function SelectField<T extends string>({ value, onChange, options, label, className }: SelectFieldProps<T>) {
  const id = useId()
  return (
    <div className={cls('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cls(
          'w-full appearance-none rounded-pill border border-line bg-surface-2 py-2 pr-8 pl-3.5 text-sm text-ink',
          'transition-colors hover:border-line-strong focus:border-line-strong focus:outline-none',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={15}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

/** Sticky filter bar shared by every list route. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cls(
        'flex flex-col gap-3 rounded-card border border-line bg-surface/80 p-3 backdrop-blur sm:flex-row sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ResultCount({ shown, total, noun, className }: { shown: number; total: number; noun: string; className?: string }) {
  const filtered = shown !== total
  return (
    <p aria-live="polite" className={cls('nums text-xs text-ink-muted', className)}>
      {shown.toLocaleString('en-US')}
      {filtered ? ` of ${total.toLocaleString('en-US')}` : ''} {noun}
    </p>
  )
}

/** Clickable filter pill used for multi-select facets. */
export function FilterChip({
  active,
  onClick,
  children,
  count,
  className,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cls(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
        active
          ? 'border-transparent bg-accent-solid text-accent-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      {children}
      {typeof count === 'number' ? (
        <span className={cls('nums font-mono text-[10.5px]', active ? 'text-accent-ink' : 'text-ink-faint')}>
          {count}
        </span>
      ) : null}
    </button>
  )
}
