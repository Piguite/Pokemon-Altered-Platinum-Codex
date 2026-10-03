import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { SearchKind } from "../types/data"
import { cls } from "../lib/format"
import { searchTargetPath } from "../lib/routes"
import { SEARCH_KIND_LABELS, SEARCH_KIND_ORDER, groupHits, highlight, kindLabel, runSearch, useSearchIndex } from "../lib/search"
import type { SearchHit } from "../lib/search"
import { Card } from "../components/ui/Card"
import { EmptyState } from "../components/ui/EmptyState"
import { Icon } from "../components/ui/Icon"
import { PageHeader } from "../components/ui/SectionHeader"
import { SearchField } from "../components/ui/Controls"
import { SkeletonRows } from "../components/ui/Skeleton"
import { TypeBadge } from "../components/ui/TypeBadge"
import { TYPE_ORDER } from "../lib/typechart"

const MAX_RESULTS = 200

function isTypeName(value: string): boolean {
  return (TYPE_ORDER as readonly string[]).includes(value) || value === '???'
}

function HitRow({ hit }: { hit: SearchHit }) {
  const chunks = highlight(hit.record.title, hit.matches, 'title')
  return (
    <li>
      <Link
        to={searchTargetPath(hit.record)}
        className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            {chunks.map((chunk, index) =>
              chunk.hit ? (
                <mark key={index} className="rounded bg-accent/25 px-0.5 text-ink">
                  {chunk.text}
                </mark>
              ) : (
                <span key={index}>{chunk.text}</span>
              ),
            )}
          </span>
          {hit.record.subtitle ? (
            <span className="mt-0.5 block truncate text-xs text-ink-muted">{hit.record.subtitle}</span>
          ) : null}
        </span>
        {/*
          Must be shrinkable and wrap: with `shrink-0` a long badge run took its
          full max-content width and pushed the whole results page sideways on
          narrow screens.
        */}
        <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <span className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-ink-faint">
            {kindLabel(hit.record.kind)}
          </span>
          {hit.record.badges.slice(0, 4).map((badge) =>
            isTypeName(badge) ? (
              <TypeBadge key={badge} type={badge} size="xs" />
            ) : (
              <span
                key={badge}
                className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted"
              >
                {badge}
              </span>
            ),
          )}
          <Icon name="chevronRight" size={15} className="text-ink-faint" />
        </span>
      </Link>
    </li>
  )
}

export function SearchView() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { fuse, loading } = useSearchIndex()

  const queryFromUrl = params.get('q') ?? ''
  const [query, setQuery] = useState(queryFromUrl)
  const [kinds, setKinds] = useState<Set<SearchKind>>(new Set())

  // Keep the input in sync when the URL changes (e.g. the palette's "see all results").
  useEffect(() => {
    setQuery(queryFromUrl)
  }, [queryFromUrl])

  // Debounce the URL update so the address bar stays shareable without thrash.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(id)
  }, [query, params, setParams])

  const hits = useMemo(() => runSearch(fuse, query, MAX_RESULTS, kinds), [fuse, query, kinds])
  const groups = useMemo(() => groupHits(hits), [hits])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global search"
        subtitle="Full-text search across the whole documentation: Pokémon, Sinnohan forms, types, moves, items, trainers, areas, events, FAQ and guides."
        meta={
          <span className="text-xs text-ink-muted">
            Shortcut: <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono">⌘</kbd>
            <kbd className="ml-0.5 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono">K</kbd> from
            any page
          </span>
        }
      />

      <SearchField
        value={query}
        onChange={setQuery}
        onClear={() => setQuery('')}
        label="Search the documentation"
        placeholder="Pokémon name (in English), move, item, area, trainer…"
        autoFocus
      />

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <button
          type="button"
          aria-pressed={kinds.size === 0}
          onClick={() => setKinds(new Set())}
          className={cls(
            'shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
            kinds.size === 0 ? 'bg-accent-solid text-accent-ink' : 'bg-surface-2 text-ink-muted hover:text-ink',
          )}
        >
          All categories
        </button>
        {SEARCH_KIND_ORDER.map((kind) => {
          const active = kinds.has(kind)
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setKinds((current) => {
                  const next = new Set(current)
                  if (next.has(kind)) next.delete(kind)
                  else next.add(kind)
                  return next
                })
              }
              className={cls(
                'shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                active ? 'bg-accent-solid text-accent-ink' : 'bg-surface-2 text-ink-muted hover:text-ink',
              )}
            >
              {SEARCH_KIND_LABELS[kind]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : query.trim().length === 0 ? (
        <EmptyState
          icon="search"
          title="Start typing"
          description="Pokémon, move, item and area names are in English — that is what the game uses."
          action={
            <button
              type="button"
              onClick={() => navigate('/pokemon')}
              className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Browse the Pokémon
            </button>
          }
        />
      ) : hits.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No results for “${query}”`}
          description="Try a shorter name, the English spelling (Charizard, Hydro Pump, Leftovers…), or remove the category filters."
        />
      ) : (
        <>
          <p aria-live="polite" className="nums text-xs text-ink-muted">
            {hits.length}
            {hits.length >= MAX_RESULTS ? '+' : ''} results
          </p>
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.kind} aria-labelledby={`search-${group.kind}`}>
                <h2
                  id={`search-${group.kind}`}
                  className="mb-2 flex items-center gap-2 text-sm font-bold tracking-tight text-ink"
                >
                  {SEARCH_KIND_LABELS[group.kind]}
                  <span className="nums rounded-pill bg-surface-3 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-faint">
                    {group.hits.length}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {group.hits.map((hit) => (
                    <HitRow key={hit.record.id} hit={hit} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Card className="text-xs leading-relaxed text-ink-muted">
        Search covers every document in the codex — Pokémon, moves, items, trainers, encounters, events
        and guides — and the index is loaded once per visit, so results appear as you type. Use the
        global search (⌘K) to navigate with the keyboard.
      </Card>
    </div>
  )
}
