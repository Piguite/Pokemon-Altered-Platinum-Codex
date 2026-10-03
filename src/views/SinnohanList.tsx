import { useMemo, useState } from 'react'
import type { SinnohanForm } from "../types/data"
import { matches, plural, statTotal } from "../lib/format"
import { loadSinnohan, useData } from "../lib/data"
import { TYPE_ORDER } from "../lib/typechart"
import { Badge } from "../components/ui/Card"
import { FilterChip, ResultCount, SearchField, SelectField, Toolbar } from "../components/ui/Controls"
import { EmptyState } from "../components/ui/EmptyState"
import { Callout } from "../components/ui/Prose"
import { PageHeader } from "../components/ui/SectionHeader"
import { SkeletonGrid } from "../components/ui/Skeleton"
import { SinnohanCard } from "../components/pokemon/PokemonCard"

type SortKey = 'dexAsc' | 'nameAsc' | 'bstDesc' | 'bstAsc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'dexAsc', label: 'Dex no. (ascending)' },
  { value: 'nameAsc', label: 'Name (A → Z)' },
  { value: 'bstDesc', label: 'BST (descending)' },
  { value: 'bstAsc', label: 'BST (ascending)' },
]

export function SinnohanList() {
  const { data: forms, loading } = useData(loadSinnohan)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState<SortKey>('dexAsc')

  const all = useMemo(() => forms ?? [], [forms])

  const typeOptions = useMemo(() => {
    const present = new Set<string>()
    for (const form of all) for (const t of form.types) present.add(t)
    return [
      { value: 'all', label: 'All types' },
      ...TYPE_ORDER.filter((t) => present.has(t)).map((t) => ({ value: t, label: t })),
    ]
  }, [all])

  const filtered = useMemo(() => {
    const list = all.filter((form) => {
      if (type !== 'all' && !form.types.includes(type)) return false
      if (query.trim()) {
        const haystack = [
          form.name,
          form.baseName,
          form.abilities.join(' '),
          form.types.join(' '),
          form.learnset.levelUp.map((entry) => entry.move).join(' '),
        ].join(' ')
        if (!matches(haystack, query)) return false
      }
      return true
    })
    const bst = (form: SinnohanForm) => form.stats.bst || statTotal(form.stats)
    switch (sort) {
      case 'dexAsc':
        return list.sort((a, b) => a.dex - b.dex)
      case 'nameAsc':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'en'))
      case 'bstDesc':
        return list.sort((a, b) => bst(b) - bst(a))
      case 'bstAsc':
        return list.sort((a, b) => bst(a) - bst(b))
      default:
        return list
    }
  }, [all, type, query, sort])

  const averageBst = useMemo(() => {
    if (all.length === 0) return 0
    const total = all.reduce((sum, form) => sum + (form.stats.bst || statTotal(form.stats)), 0)
    return Math.round(total / all.length)
  }, [all])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sinnohan forms"
        subtitle="The regional forms created for Altered Platinum: new types, abilities, stats and learnsets. They replace the original forms entirely and cannot breed."
        meta={
          <>
            <Badge tone="accent">{plural(all.length, 'form')}</Badge>
            {averageBst > 0 ? <Badge tone="outline">Average BST {averageBst}</Badge> : null}
            <Badge tone="outline">All marked with an “S” badge</Badge>
          </>
        }
      />

      <Callout tone="info" title="What to know before building a team">
        A Sinnohan form occupies the slot of the species it replaces: you cannot catch both. The sprites
        shown are those of the original species — the hack uses custom sprites that cannot be
        redistributed — hence the systematic <strong className="font-semibold text-ink">S</strong> badge.
      </Callout>

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for a Sinnohan form"
          placeholder="Name, type, ability, move…"
          className="sm:max-w-sm sm:flex-1"
        />
        <SelectField value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort forms" className="sm:w-48" />
        <SelectField value={type} onChange={setType} options={typeOptions} label="Filter by type" className="sm:w-44" />
        {query || type !== 'all' ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setType('all')
            }}
            className="text-xs font-medium text-accent hover:underline"
          >
            Reset
          </button>
        ) : null}
      </Toolbar>

      <div className="flex items-center justify-between gap-3">
        <ResultCount shown={filtered.length} total={all.length} noun="forms" />
        <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {TYPE_ORDER.filter((t) => all.some((form) => form.types.includes(t)))
            .slice(0, 8)
            .map((t) => (
              <FilterChip key={t} active={type === t} onClick={() => setType(type === t ? 'all' : t)}>
                {t}
              </FilterChip>
            ))}
        </div>
      </div>

      {loading ? (
        <SkeletonGrid count={12} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No form matches"
          description="Try another name or reset the filters."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((form) => (
            <li key={`${form.dex}-${form.slug}`}>
              <SinnohanCard form={form} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
