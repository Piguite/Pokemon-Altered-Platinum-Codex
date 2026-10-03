import { useState } from 'react'
import type { ReactNode } from 'react'
import type { NoteSection, RawSection } from "../../types/data"
import { cls } from "../../lib/format"
import { Icon } from './Icon'
import type { IconName } from './Icon'

/* ------------------------------------------------------------------ */
/* Bullet list                                                         */
/* ------------------------------------------------------------------ */

export function BulletList({
  lines,
  className,
  icon = 'chevronRight',
  dense = false,
}: {
  lines: string[]
  className?: string
  icon?: IconName | null
  dense?: boolean
}) {
  if (lines.length === 0) return null
  return (
    <ul className={cls('space-y-1.5', dense && 'space-y-1', className)}>
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          {icon ? <Icon name={icon} size={14} className="mt-[5px] shrink-0 text-ink-faint" /> : null}
          <span className="min-w-0">{line}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Callout                                                             */
/* ------------------------------------------------------------------ */

export type CalloutTone = 'info' | 'warn' | 'accent' | 'good'

const CALLOUT_TONES: Record<CalloutTone, { wrap: string; icon: IconName }> = {
  info: { wrap: 'border-info/30 bg-info/8', icon: 'info' },
  warn: { wrap: 'border-warn/30 bg-warn/8', icon: 'alert' },
  accent: { wrap: 'border-accent/30 bg-accent/8', icon: 'sparkles' },
  good: { wrap: 'border-good/30 bg-good/8', icon: 'check' },
}

export function Callout({
  tone = 'info',
  title,
  children,
  className,
  icon,
}: {
  tone?: CalloutTone
  title?: ReactNode
  children?: ReactNode
  className?: string
  icon?: IconName
}) {
  const config = CALLOUT_TONES[tone]
  return (
    <div className={cls('flex gap-3 rounded-card border px-4 py-3', config.wrap, className)}>
      <Icon name={icon ?? config.icon} size={17} className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
        {children ? <div className={cls('text-sm leading-relaxed text-ink-muted', Boolean(title) && 'mt-1')}>{children}</div> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Note sections (verbatim prose from the source documents)            */
/* ------------------------------------------------------------------ */

export function NoteSections({ sections, className }: { sections: NoteSection[]; className?: string }) {
  if (sections.length === 0) return null
  return (
    <div className={cls('space-y-5', className)}>
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-sm font-semibold tracking-tight text-ink">{section.title}</h3>
          <BulletList lines={section.lines} />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Raw source sections (collapsible, "nothing is lost")                */
/* ------------------------------------------------------------------ */

export function RawSections({
  sections,
  title = 'Raw sections',
  className,
  defaultOpen = false,
}: {
  sections: RawSection[]
  title?: string
  className?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (sections.length === 0) return null
  return (
    <div className={cls('rounded-card border border-line bg-surface', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="clipboard" size={16} className="text-ink-faint" />
          {title}
          <span className="nums rounded-pill bg-surface-3 px-1.5 py-px font-mono text-[10px] text-ink-faint">
            {sections.length}
          </span>
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={cls('shrink-0 text-ink-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {sections.map((section, index) => (
            <div key={`${section.title}-${index}`}>
              <h4 className="mb-1.5 font-mono text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                {section.title}
              </h4>
              <pre className="scroll-thin overflow-x-auto rounded-lg bg-canvas-2 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-muted">
                {section.lines.join('\n')}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
