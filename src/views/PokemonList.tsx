import { useCallback, useMemo, useState } from 'react'
import type { ChangeKind, PokemonChange, SinnohanForm } from "../types/data"
import { matches, plural } from "../lib/format"
import { loadPokemon, loadSinnohan, findSinnohan, useData } from "../lib/data"
import { CHANGE_KIND_LABELS, CHANGE_KIND_ORDER, SORT_LABELS } from "../lib/labels"
import { effectiveTypes } from "../lib/typechange"
import { TYPE_ORDER } from "../lib/typechart"
import { Badge } from "../components/ui/Card"
import { FilterChip, ResultCount, SelectField, SearchField, Toolbar } from "../components/ui/Controls"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader } from "../components/ui/SectionHeader"
import { SkeletonGrid } from "../components/ui/Skeleton"
import { PokemonCard } from "../components/pokemon/PokemonCard"

type SortKey = 'dexAsc' | 'dexDesc' | 'nameAsc' | 'nameDesc' | 'deltaDesc' | 'deltaAsc' | 'bstDesc'
type Origin = 'all' | 'base' | 'sinnohan'

const PAGE_SIZE = 48

const SORT_OPTIONS: { value: SortKey; label: string }[] = (
  ['dexAsc', 'dexDesc', 'nameAsc', 'nameDesc', 'deltaDesc', 'bstDesc', 'deltaAsc'] as SortKey[]
).map((value) => ({ value, label: SORT_LABELS[value] }))

function deltaOf(entry: PokemonChange): number {
  return entry.stats ? entry.stats.new.bst - entry.stats.old.bst : 0
}

function bstOf(entry: PokemonChange): number {
  /* rev 2: `baseStats` is always present once the baseline enrichment ran. */
  return entry.baseStats?.bst ?? entry.stats?.new.bst ?? 0
}

function sortEntries(entries: PokemonChange[], key: SortKey): PokemonChange[] {
  const copy = [...entries]
  switch (key) {
    case 'dexAsc':
      return copy.sort((a, b) => a.dex - b.dex)
    case 'dexDesc':
      return copy.sort((a, b) => b.dex - a.dex)
    case 'nameAsc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'en'))
    case 'nameDesc':
      return copy.sort((a, b) => b.name.localeCompare(a.name, 'en'))
    case 'deltaDesc':
      return copy.sort((a, b) => deltaOf(b) - deltaOf(a) || a.dex - b.dex)
    case 'deltaAsc':
      return copy.sort((a, b) => deltaOf(a) - deltaOf(b) || a.dex - b.dex)
    case 'bstDesc':
      return copy.sort((a, b) => bstOf(b) - bstOf(a) || a.dex - b.dex)
    default:
      return copy
  }
}

export function PokemonList() {
  const { data: pokemon, loading } = useData(loadPokemon)
  const { data: sinnohan } = useData(loadSinnohan)

  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<ChangeKind>>(new Set())
  const [type, setType] = useState<string>('all')
  const [origin, setOrigin] = useState<Origin>('all')
  const [sort, setSort] = useState<SortKey>('dexAsc')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const entries = useMemo(() => pokemon ?? [], [pokemon])

  /*
   * rev 3: a Sinnohan entry in PokemonChanges.txt carries no `type` — the type
   * change is only recorded in SinnohanForms.txt. The two files key the same
   * species by national dex number, so the form supplies the card's change.
   */
  const sinnohanByDex = useMemo(() => {
    const map = new Map<number, SinnohanForm>()
    for (const form of sinnohan ?? []) map.set(form.dex, form)
    return map
  }, [sinnohan])

  /**
   * The Sinnohan form behind an entry: same national dex, or failing that the
   * one whose slug matches under either convention (`absol` / `sinnohan-absol`).
   */
  const sinnohanFormFor = useCallback(
    (entry: PokemonChange): SinnohanForm | undefined =>
      sinnohanByDex.get(entry.dex) ?? findSinnohan(sinnohan ?? [], entry.slug),
    [sinnohanByDex, sinnohan],
  )

  /*
   * The list of types an entry is matched on — the exact set the cards draw
   * from. Built from `effectiveTypes`, so filtering by a type a Pokémon has
   * *now*, a type it *had*, or the typing it keeps from the vanilla games all
   * work, and the dropdown can never miss a type a card displays.
   */
  const typesByEntry = useMemo(() => {
    const map = new Map<PokemonChange, string[]>()
    for (const entry of entries) {
      map.set(entry, effectiveTypes(entry, entry.isSinnohan ? sinnohanFormFor(entry) : undefined))
    }
    return map
  }, [entries, sinnohanFormFor])

  const typeOptions = useMemo(() => {
    const present = new Set<string>()
    for (const types of typesByEntry.values()) for (const t of types) present.add(t)
    const ordered = TYPE_ORDER.filter((t) => present.has(t))
    const extra = [...present].filter((t) => !(TYPE_ORDER as string[]).includes(t))
    return [
      { value: 'all', label: 'All types' },
      ...ordered.map((t) => ({ value: t, label: t })),
      ...extra.map((t) => ({ value: t, label: t })),
    ]
  }, [typesByEntry])

  const kindCounts = useMemo(() => {
    const counts = new Map<ChangeKind, number>()
    for (const entry of entries) {
      for (const kind of entry.changeKinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
    return counts
  }, [entries])

  const filtered = useMemo(() => {
    const haystack = (entry: PokemonChange) =>
      [
        entry.name,
        entry.slug,
        String(entry.dex),
        (typesByEntry.get(entry) ?? []).join(' '),
        (entry.ability?.new ?? []).join(' '),
        (entry.ability?.old ?? []).join(' '),
        entry.moves.map((m) => m.text).join(' '),
        entry.learnset.levelUp.map((l) => `${l.move} ${l.replaces ?? ''}`).join(' '),
        entry.learnset.tm.map((l) => l.move).join(' '),
        entry.learnset.tutor.map((tutor) => tutor.move).join(' '),
        entry.changeKinds.join(' '),
      ].join(' ')

    const result = entries.filter((entry) => {
      if (origin === 'sinnohan' && !entry.isSinnohan) return false
      if (origin === 'base' && entry.isSinnohan) return false
      if (type !== 'all' && !(typesByEntry.get(entry) ?? []).includes(type)) return false
      if (kinds.size > 0 && !entry.changeKinds.some((kind) => kinds.has(kind))) return false
      if (query.trim() && !matches(haystack(entry), query)) return false
      return true
    })
    return sortEntries(result, sort)
  }, [entries, typesByEntry, origin, type, kinds, query, sort])

  const visible = filtered.slice(0, limit)
  const activeFilters = kinds.size > 0 || type !== 'all' || origin !== 'all' || query.trim().length > 0

  const clearAll = useCallback(() => {
    setQuery('')
    setKinds(new Set())
    setType('all')
    setOrigin('all')
    setLimit(PAGE_SIZE)
  }, [])

  const sinnohanCount = useMemo(() => entries.filter((e) => e.isSinnohan).length, [entries])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modified Pokémon"
        subtitle="Every entry of PokemonChanges.txt: types, stats, abilities, moves and learnsets. Open a card to compare it with the original values."
        meta={
          <>
            <Badge tone="accent">{plural(entries.length, 'entry', 'entries')}</Badge>
            {sinnohanCount > 0 ? <Badge tone="outline">{plural(sinnohanCount, 'Sinnohan form')}</Badge> : null}
            {sinnohan ? (
              <Badge tone="outline">{plural(sinnohan.length, 'detailed Sinnohan entry', 'detailed Sinnohan entries')}</Badge>
            ) : null}
          </>
        }
      />

      <Toolbar className="sticky top-[52px] z-20 md:top-[88px]">
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value)
            setLimit(PAGE_SIZE)
          }}
          onClear={() => setQuery('')}
          label="Search for a Pokémon"
          placeholder="Name, type, move, ability…"
          className="sm:max-w-sm sm:flex-1"
        />
        <SelectField
          value={sort}
          onChange={setSort}
          options={SORT_OPTIONS}
          label="Sort results"
          className="sm:w-52"
        />
        <SelectField
          value={type}
          onChange={setType}
          options={typeOptions}
          label="Filter by type"
          className="sm:w-44"
        />
        <div className="flex items-center gap-1.5">
          <FilterChip active={origin === 'all'} onClick={() => setOrigin('all')}>
            All
          </FilterChip>
          <FilterChip active={origin === 'base'} onClick={() => setOrigin('base')}>
            Base forms
          </FilterChip>
          <FilterChip active={origin === 'sinnohan'} onClick={() => setOrigin('sinnohan')}>
            Sinnohan
          </FilterChip>
        </div>
      </Toolbar>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Change kind
        </span>
        {CHANGE_KIND_ORDER.filter((kind) => (kindCounts.get(kind) ?? 0) > 0).map((kind) => (
          <FilterChip
            key={kind}
            active={kinds.has(kind)}
            count={kindCounts.get(kind)}
            onClick={() =>
              setKinds((current) => {
                const next = new Set(current)
                if (next.has(kind)) next.delete(kind)
                else next.add(kind)
                return next
              })
            }
          >
            {CHANGE_KIND_LABELS[kind]}
          </FilterChip>
        ))}
        {activeFilters ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-xs font-medium text-accent hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <ResultCount shown={filtered.length} total={entries.length} noun="entries" />
        {filtered.length > limit ? (
          <button type="button" onClick={() => setLimit(filtered.length)} className="text-xs font-medium text-accent hover:underline">
            Show all
          </button>
        ) : null}
      </div>

      {loading ? (
        <SkeletonGrid count={12} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No Pokémon matches"
          description="Try another name (in English, as in the game), a type, or reset the filters."
          action={
            <button
              type="button"
              onClick={clearAll}
              className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((entry) => (
              <li key={`${entry.dex}-${entry.slug}`}>
                <PokemonCard
                  entry={entry}
                  sinnohanForm={entry.isSinnohan ? sinnohanFormFor(entry) : undefined}
                />
              </li>
            ))}
          </ul>
          {filtered.length > visible.length ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimit((value) => value + PAGE_SIZE * 2)}
                className="rounded-pill border border-line-strong bg-surface-2 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink-faint"
              >
                Show {Math.min(PAGE_SIZE * 2, filtered.length - visible.length)} more entries
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
