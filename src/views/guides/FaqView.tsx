import { useMemo, useState } from 'react'
import { loadMisc, useData } from "../../lib/data"
import { matches, plural } from "../../lib/format"
import { Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { BulletList } from "../../components/ui/Prose"
import { SearchField, Toolbar } from "../../components/ui/Controls"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonText } from "../../components/ui/Skeleton"

export function FaqView() {
  const { data: misc, loading } = useData(loadMisc)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<number | null>(0)

  const entries = useMemo(() => {
    const list = misc?.faq ?? []
    if (!query.trim()) return list
    return list.filter((entry) =>
      matches(
        `${entry.question} ${entry.answer.join(' ')} ${entry.subsections.map((s) => `${s.title} ${s.lines.join(' ')}`).join(' ')}`,
        query,
      ),
    )
  }, [misc, query])

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQ"
        subtitle="The frequently asked questions gathered by the author, with the full answers and their additional notes."
        meta={<span className="text-xs text-ink-muted">{plural(misc?.faq.length ?? 0, 'question')}</span>}
      />

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search the FAQ"
          placeholder="Keyword: evolution, shiny, items…"
          className="sm:max-w-md sm:flex-1"
        />
        <span className="nums shrink-0 text-xs text-ink-muted">
          {entries.length} / {misc?.faq.length ?? 0}
        </span>
      </Toolbar>

      {loading ? (
        <SkeletonText lines={10} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="info"
          title="No question matches"
          description="Try a shorter keyword, or use the global search (⌘K)."
        />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => {
            const isOpen = open === index
            return (
              <li key={entry.question}>
                <Card padded={false}>
                  <h2>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <Icon name="info" size={16} className="shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{entry.question}</span>
                      <Icon
                        name="chevronDown"
                        size={16}
                        className={`shrink-0 text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h2>
                  {isOpen ? (
                    <div className="space-y-4 border-t border-line px-4 py-4">
                      <BulletList lines={entry.answer} icon={null} />
                      {entry.subsections.map((section) => (
                        <div key={section.title} className="rounded-lg border border-line bg-surface-2 p-3">
                          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                            {section.title}
                          </h3>
                          <BulletList lines={section.lines} dense />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
