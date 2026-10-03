import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keyOf, loadEvolutions, useData } from "../lib/data"
import { matches, plural } from "../lib/format"
import { Badge, Card } from "../components/ui/Card"
import { FilterChip, ResultCount, SearchField, Toolbar } from "../components/ui/Controls"
import { EmptyState } from "../components/ui/EmptyState"
import { Icon } from "../components/ui/Icon"
import { Callout } from "../components/ui/Prose"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SkeletonRows } from "../components/ui/Skeleton"

export function EvolutionsView() {
  const { data: doc, loading } = useData(loadEvolutions)
  const [params, setParams] = useSearchParams()
  const queryFromUrl = params.get('q') ?? ''
  const [query, setQuery] = useState(queryFromUrl)
  const [section, setSection] = useState('all')

  const sections = doc?.sections ?? []

  /* A search result links to `#/evolutions?q=<species>` — keep the two in sync. */
  useEffect(() => {
    setQuery(queryFromUrl)
  }, [queryFromUrl])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(id)
  }, [query, params, setParams])

  const visible = useMemo(() => {
    return sections
      .filter((entry) => section === 'all' || entry.title === section)
      .map((entry) => ({
        ...entry,
        entries: entry.entries.filter((item) =>
          query.trim() ? matches(`${item.pokemon} ${item.text}`, query) : true,
        ),
      }))
      .filter((entry) => entry.entries.length > 0)
  }, [sections, query, section])

  const total = useMemo(
    () => sections.reduce((sum, entry) => sum + entry.entries.length, 0),
    [sections],
  )
  const shown = visible.reduce((sum, entry) => sum + entry.entries.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evolution changes"
        subtitle="Evolutions by item (like an evolution stone), level adjustments and new methods. No more mandatory trading."
        meta={
          <>
            <Badge tone="accent">{plural(total, 'change')}</Badge>
            <Badge tone="outline">{plural(sections.length, 'category', 'categories')}</Badge>
          </>
        }
      />

      <Callout tone="info" title="“Using” an item">
        Items that used to require a trade now work <strong className="font-semibold text-ink">directly</strong>{' '}
        on the Pokémon, exactly like a Fire Stone — no trading required.
      </Callout>

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for an evolution change"
          placeholder="Pokémon name, item, level…"
          className="sm:max-w-md sm:flex-1"
        />
        <ResultCount shown={shown} total={total} noun="changes" className="shrink-0" />
      </Toolbar>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={section === 'all'} onClick={() => setSection('all')} count={total}>
          All categories
        </FilterChip>
        {sections.map((entry) => (
          <FilterChip
            key={entry.title}
            active={section === entry.title}
            count={entry.entries.length}
            onClick={() => setSection(entry.title)}
          >
            {entry.title}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="shuffle"
          title="No change matches"
          description="Try another Pokémon name or reset the filters."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSection('all')
              }}
              className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Reset
            </button>
          }
        />
      ) : (
        visible.map((entry) => (
          <section key={entry.title} aria-labelledby={`evo-${keyOf(entry.title)}`} className="space-y-3">
            <SectionHeader
              id={`evo-${keyOf(entry.title)}`}
              title={entry.title}
              subtitle={
                entry.lines.length > 0 && entry.entries.length === 0
                  ? entry.lines.join(' ')
                  : plural(entry.entries.length, 'change')
              }
              icon="shuffle"
            />
            <ul className="grid gap-2 sm:grid-cols-2">
              {entry.entries.map((item, index) => {
                const isSinnohan = /\(S\)/.test(item.pokemon)
                const cleanName = item.pokemon.replace(/\s*\(S\)\s*/g, '')
                return (
                  <li key={`${item.pokemon}-${index}`}>
                    <Card padded={false} className="h-full">
                      <div className="flex h-full flex-col gap-2 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/pokemon/${keyOf(cleanName)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-ink hover:text-accent"
                          >
                            {cleanName}
                            {isSinnohan ? <Badge tone="accent">S</Badge> : null}
                          </Link>
                        </div>
                        <p className="text-xs leading-relaxed text-ink-muted">
                          {item.text.includes(':') ? item.text.slice(item.text.indexOf(':') + 1).trim() : item.text}
                        </p>
                        <Link
                          to={`/pokemon/${keyOf(cleanName)}`}
                          className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-ink-faint transition-colors hover:text-ink"
                        >
                          View entry <Icon name="chevronRight" size={12} />
                        </Link>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
