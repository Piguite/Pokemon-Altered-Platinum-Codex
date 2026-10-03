import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadEvents, useData } from "../lib/data"
import { matches, plural } from "../lib/format"
import { Badge, Card } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SearchField, Toolbar } from "../components/ui/Controls"
import { SkeletonGrid } from "../components/ui/Skeleton"
import { BulletList, Callout } from "../components/ui/Prose"

export function EventsView() {
  const { data: doc, loading } = useData(loadEvents)
  /*
   * `#/events?q=Rotom` — the Pokémon detail pages link here from the
   * form-change note, so the search has to arrive pre-filled.
   */
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')

  function search(value: string) {
    setQuery(value)
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const sections = useMemo(() => {
    const list = doc?.sections ?? []
    if (!query.trim()) return list
    return list
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          matches(`${item.title} ${item.location ?? ''} ${item.level ?? ''} ${item.lines.join(' ')}`, query),
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [doc, query])

  const total = useMemo(
    () => (doc?.sections ?? []).reduce((sum, section) => sum + section.items.length, 0),
    [doc],
  )
  const shown = sections.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Special events"
        subtitle="Gift Pokémon, static encounters and in-game trades: where to go, at what level, and how to obtain them."
        meta={
          <>
            <Badge tone="accent">{plural(total, 'event')}</Badge>
            <Badge tone="outline">{plural(doc?.sections.length ?? 0, 'category', 'categories')}</Badge>
          </>
        }
      />

      {(doc?.generalNotes.length ?? 0) > 0 ? (
        <Callout tone="good" title="Good news">
          <BulletList lines={doc?.generalNotes ?? []} icon={null} dense />
        </Callout>
      ) : null}

      <Toolbar>
        <SearchField
          value={query}
          onChange={search}
          onClear={() => search('')}
          label="Search for an event"
          placeholder="Location, Pokémon, level…"
          className="sm:max-w-md sm:flex-1"
        />
        <span className="nums shrink-0 text-xs text-ink-muted">
          {shown} / {total}
        </span>
      </Toolbar>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="gift"
          title="No event matches"
          description="Place and Pokémon names are in English, as in the game."
          action={
            <button
              type="button"
              onClick={() => search('')}
              className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Reset
            </button>
          }
        />
      ) : (
        sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <SectionHeader
              title={section.title}
              icon="gift"
              subtitle={plural(section.items.length, 'event')}
            />
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <Card className="flex h-full flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-ink">{item.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.location ? (
                          <Badge tone="info">
                            <Icon name="mapPin" size={11} />
                            {item.location}
                          </Badge>
                        ) : null}
                        {item.level ? (
                          <Badge tone="neutral" mono>
                            Lv. {item.level}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-auto border-t border-line pt-3">
                      <BulletList lines={item.lines} dense />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
