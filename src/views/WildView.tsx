import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EncounterMethod, WildArea } from "../types/data"
import { cls, matches, plural } from "../lib/format"
import { loadWild, useData } from "../lib/data"
import { speciesRoute } from "../lib/routes"
import { useSpeciesDex } from "../lib/useSpeciesDex"
import { Badge } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { FilterChip, SearchField, SegmentedControl, Toolbar } from "../components/ui/Controls"
import { DataTable } from "../components/ui/DataTable"
import type { Column, SortState } from "../components/ui/DataTable"
import { SkeletonRows, SkeletonText } from "../components/ui/Skeleton"
import { BulletList, Callout } from "../components/ui/Prose"

type DexLookup = (species: string, sinnohan: boolean) => number | undefined

/** Species name in a wild table: a link to its page whenever it resolves. */
function SpeciesName({ species, sinnohan, dexOf }: { species: string; sinnohan: boolean; dexOf: DexLookup }) {
  const known = typeof dexOf(species, sinnohan) === 'number'
  return (
    <>
      {known ? (
        <Link
          to={speciesRoute(species, sinnohan)}
          className="min-w-0 break-words text-ink transition-colors hover:text-accent hover:underline"
        >
          {species}
        </Link>
      ) : (
        <span className="min-w-0 break-words text-ink">{species}</span>
      )}
      {sinnohan ? (
        <span className="ml-1.5 font-mono text-[10px] font-bold text-accent" title="Sinnohan form">
          (S)
        </span>
      ) : null}
    </>
  )
}

interface EncounterRow {
  area: string
  levels: string
  method: string
  species: string
  percent: number
  isSinnohan: boolean
}

function methodIcon(method: string): 'sun' | 'moon' | 'sparkles' | 'trending' | 'mapPin' {
  switch (method) {
    case 'Morning':
    case 'Day':
      return 'sun'
    case 'Night':
      return 'moon'
    case 'Honey Tree':
      return 'sparkles'
    case 'Poké Radar':
      return 'trending'
    default:
      return 'mapPin'
  }
}

function methodTone(method: string): string {
  if (method === 'Morning') return 'border-good/40 bg-good/10 text-good'
  if (method === 'Day') return 'border-warn/40 bg-warn/10 text-warn'
  if (method === 'Night') return 'border-info/40 bg-info/10 text-info'
  return 'border-line bg-surface-2 text-ink-muted'
}

function MethodBlock({ method, dexOf }: { method: EncounterMethod; dexOf: DexLookup }) {
  const sorted = [...method.slots].sort((a, b) => b.percent - a.percent)
  const total = sorted.reduce((sum, slot) => sum + slot.percent, 0)
  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <span
          className={cls(
            'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold',
            methodTone(method.method),
          )}
        >
          <Icon name={methodIcon(method.method)} size={12} />
          {method.method}
        </span>
        <span className="nums font-mono text-[11px] text-ink-faint">
          {/* `species` is invariant — the default `+s` would render "speciess". */}
          {plural(method.slots.length, 'species', 'species')} · {total}%
        </span>
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((slot, index) => (
          <li key={`${slot.species}-${index}`} className="flex items-center gap-3 px-3.5 py-2">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
              <SpeciesName species={slot.species} sinnohan={slot.isSinnohan} dexOf={dexOf} />
            </span>
            <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-pill bg-surface-3 sm:w-32" aria-hidden="true">
              <span
                className="block h-full rounded-pill bg-accent/70"
                style={{ width: `${Math.max(2, Math.min(100, slot.percent))}%` }}
              />
            </span>
            <span className="nums w-10 shrink-0 text-right font-mono text-xs font-semibold text-ink">
              {slot.percent}%
            </span>
          </li>
        ))}
        {sorted.length === 0 ? <li className="px-3.5 py-3 text-xs text-ink-faint">No species listed.</li> : null}
      </ul>
    </div>
  )
}

export function WildView() {
  const { data: doc, loading } = useData(loadWild)
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('all')
  const [params, setParams] = useSearchParams()
  const selected = params.get('area')
  const [view, setView] = useState<'zones' | 'table'>('zones')
  const [sort, setSort] = useState<SortState>({ key: 'area', dir: 'asc' })

  const areas = doc?.areas ?? []
  const dexOf = useSpeciesDex()

  /** The selected zone lives in the URL so any encounter table is shareable. */
  function selectArea(name: string) {
    const next = new URLSearchParams(params)
    next.set('area', name)
    setParams(next, { replace: true })
  }

  /**
   * Opening a zone from the global table shows that zone: the view switches to
   * per-zone mode, otherwise the click would only rewrite the URL while the
   * table stayed exactly as it was.
   */
  function openArea(name: string) {
    setView('zones')
    selectArea(name)
  }

  const methods = useMemo(() => {
    const present = new Set<string>()
    for (const area of areas) for (const entry of area.methods) present.add(entry.method)
    return [...present].sort((a, b) => a.localeCompare(b, 'en'))
  }, [areas])

  const needle = query.trim()

  /**
   * The areas the filters keep, plus whether the query matched at least one area
   * *by its own name*.
   *
   * That second flag is what makes the "selection hidden" notice honest. A
   * search for a Pokémon ("scyther") matches whole areas because they hold the
   * species, but no area matches by name: there is then no zone the results
   * could disagree with, so the notice must stay silent and the panel simply
   * shows the first matching zone.
   */
  const { areas: filteredAreas, nameMatched } = useMemo(() => {
    const list = areas
      .map((area) => {
        const areaMatches = needle.length > 0 && matches(area.area, needle)
        const methods = area.methods
          .filter((entry) => method === 'all' || entry.method === method)
          .map((entry) => ({
            ...entry,
            slots:
              needle.length > 0 && !areaMatches
                ? entry.slots.filter((slot) => matches(slot.species, needle))
                : entry.slots,
          }))
          .filter((entry) => entry.slots.length > 0)
        return { ...area, methods }
      })
      .filter((area) => area.methods.length > 0)
    return {
      areas: list,
      nameMatched: needle.length > 0 && list.some((area) => matches(area.area, needle)),
    }
  }, [areas, method, needle])

  const rows: EncounterRow[] = useMemo(() => {
    const list: EncounterRow[] = []
    for (const area of filteredAreas) {
      for (const entry of area.methods) {
        for (const slot of entry.slots) {
          list.push({
            area: area.area,
            levels: area.levels,
            method: entry.method,
            species: slot.species,
            percent: slot.percent,
            isSinnohan: slot.isSinnohan,
          })
        }
      }
    }
    return list
  }, [filteredAreas])

  /** The zone the URL asks for, as the document spells it. */
  const selectedArea = useMemo(
    () => (selected ? areas.find((area) => area.area === selected) : undefined),
    [areas, selected],
  )

  /** The requested zone as the current filters render it, when it survives them. */
  const filteredSelection = useMemo(
    () =>
      selectedArea ? filteredAreas.find((area) => area.area === selectedArea.area) : undefined,
    [filteredAreas, selectedArea],
  )

  /**
   * A requested zone is hidden *and* the query targets zone names: the search
   * genuinely disagrees with the selection, which is worth saying.
   *
   * A Pokémon-name search is excluded on purpose — see `nameMatched`. So is a
   * zone hidden by the method filter alone (no query at all): that is not a
   * search mismatch and the panel keeps showing the zone that was clicked.
   */
  const selectionHidden = Boolean(selectedArea) && nameMatched && !filteredSelection

  /**
   * Area the panel shows.
   *
   * - the selection, when the filters keep it;
   * - the selection *pinned* while a method filter alone hides it, so a click
   *   is never silently replaced by another zone (its tables are filtered, and
   *   the panel says when none is left);
   * - otherwise the first matching zone — which is the whole answer to a
   *   Pokémon-name search.
   */
  const activeArea: WildArea | undefined = useMemo(() => {
    if (filteredSelection) return filteredSelection
    if (selectedArea && needle.length === 0) {
      return {
        ...selectedArea,
        methods: selectedArea.methods.filter((entry) => method === 'all' || entry.method === method),
      }
    }
    return filteredAreas[0]
  }, [filteredSelection, filteredAreas, method, needle.length, selectedArea])

  /**
   * The zone panel and the zone list must never disagree: a selection pinned
   * out of the filtered list is put back at its head, marked as such.
   */
  const zoneList = useMemo(() => {
    if (!activeArea) return filteredAreas
    if (filteredAreas.some((area) => area === activeArea)) return filteredAreas
    return [activeArea, ...filteredAreas]
  }, [activeArea, filteredAreas])

  /** Keep the requested zone visible in the (scrollable) zone list. */
  const activeRowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!selected) return
    activeRowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  const speciesCount = useMemo(() => {
    const set = new Set<string>()
    for (const area of areas) for (const entry of area.methods) for (const slot of entry.slots) set.add(slot.species)
    return set.size
  }, [areas])

  /** The pipeline can emit area shells without their encounter tables. */
  const documentIncomplete =
    !loading && areas.length > 0 && speciesCount === 0 && method === 'all' && query.trim().length === 0

  const columns: Column<EncounterRow>[] = [
    {
      key: 'species',
      header: 'Pokémon',
      primary: true,
      sortable: true,
      sortValue: (row) => row.species,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5 font-medium">
          <SpeciesName species={row.species} sinnohan={row.isSinnohan} dexOf={dexOf} />
        </span>
      ),
    },
    {
      key: 'area',
      header: 'Area',
      sortable: true,
      sortValue: (row) => row.area,
      cell: (row) => (
        /*
         * Every row shown must be reachable: the zone name opens that zone's
         * encounter tables instead of being inert text.
         */
        <button
          type="button"
          onClick={() => openArea(row.area)}
          title={`See the encounters in ${row.area}`}
          className="inline-flex max-w-full items-center gap-1 text-left text-ink-muted transition-colors hover:text-accent hover:underline"
        >
          <span className="min-w-0 break-words">{row.area}</span>
          <Icon name="chevronRight" size={12} className="shrink-0 text-ink-faint" />
        </button>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      sortable: true,
      sortValue: (row) => row.method,
      cell: (row) => (
        <span className={cls('rounded-pill border px-2 py-0.5 text-[11px] font-medium', methodTone(row.method))}>
          {row.method}
        </span>
      ),
    },
    {
      key: 'percent',
      header: '%',
      align: 'right',
      sortable: true,
      className: 'w-20',
      sortValue: (row) => row.percent,
      cell: (row) => <span className="nums font-mono text-xs font-semibold text-ink">{row.percent}%</span>,
    },
    {
      key: 'levels',
      header: 'Levels',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-ink-faint">{row.levels || '—'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wild encounters"
        subtitle="Every encounter by area and by method: Morning / Day / Night, Surf, Lures, Honey Tree and Poké Radar. Useful for knowing exactly where to find a Pokémon."
        meta={
          <>
            <Badge tone="accent">{plural(areas.length, 'area')}</Badge>
            {speciesCount > 0 ? <Badge tone="outline">≈ {plural(speciesCount, 'species', 'species')}</Badge> : null}
            {methods.length > 0 ? <Badge tone="outline">{plural(methods.length, 'method')}</Badge> : null}
          </>
        }
      />

      {(doc?.generalNotes.length ?? 0) > 0 ? (
        <Callout tone="info" title="General notes">
          <BulletList lines={doc?.generalNotes ?? []} icon={null} dense />
        </Callout>
      ) : null}

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for an area or a Pokémon"
          placeholder="Where to find… (Pokémon or area name)"
          className="sm:max-w-md sm:flex-1"
        />
        <SegmentedControl
          label="Display mode"
          value={view}
          onChange={setView}
          options={[
            { value: 'zones', label: 'By area', icon: 'mapPin' },
            { value: 'table', label: 'Full table', icon: 'list' },
          ]}
        />
      </Toolbar>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Method</span>
        <FilterChip active={method === 'all'} onClick={() => setMethod('all')}>
          All
        </FilterChip>
        {methods.map((entry) => (
          <FilterChip key={entry} active={method === entry} onClick={() => setMethod(entry)}>
            {entry}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonText lines={3} />
          <SkeletonRows rows={8} />
        </div>
      ) : documentIncomplete ? (
        <EmptyState
          icon="alert"
          title="Encounter tables not available yet"
          description={
            <>
              {plural(areas.length, 'area')} are listed for this document, but their individual
              encounters — which Pokémon appear, by which method and at what rate — are not available
              yet. The general notes above still apply, and the area list stays browsable.
            </>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="mapPin"
          title="No encounter matches"
          description="Pokémon and area names are in English, as in the game."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setMethod('all')
              }}
              className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Reset
            </button>
          }
        />
      ) : view === 'table' ? (
        <>
          <p className="nums text-xs text-ink-muted">
            {plural(rows.length, 'row')} — sortable by Pokémon, area, method or percentage.
          </p>
          <DataTable
            rows={rows}
            columns={columns}
            getKey={(row, index) => `${row.area}-${row.method}-${row.species}-${index}`}
            sort={sort}
            onSortChange={setSort}
          />
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Areas</h2>
              <span className="nums font-mono text-[11px] text-ink-faint">
                {zoneList.length}/{areas.length}
              </span>
            </div>
            <ul className="scroll-thin max-h-[32rem] overflow-y-auto p-1.5">
              {zoneList.map((area, index) => {
                /*
                 * Identity, not name: `wild.json` currently spells two distinct
                 * tables "Turnback Cave", and a name comparison highlighted (and
                 * keyed) both rows as one.
                 */
                const active = area === activeArea
                return (
                  <li key={`${area.area}-${index}`} ref={active ? activeRowRef : undefined}>
                    <button
                      type="button"
                      onClick={() => selectArea(area.area)}
                      aria-current={active ? 'true' : undefined}
                      className={cls(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        active ? 'bg-accent/12 font-semibold text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      <Icon name="mapPin" size={13} className="shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate">{area.area}</span>
                      <span className="nums shrink-0 font-mono text-[10px] text-ink-faint">{area.methods.length}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="space-y-4">
            {selectionHidden ? (
              <p
                data-notice="zone-search-hidden"
                className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted"
              >
                <Icon name="info" size={13} className="shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1">
                  The selected zone “{selected}” isn’t part of this search: the table below is{' '}
                  {activeArea?.area ?? 'the first matching zone'}, the first zone that matches.
                </span>
                <button type="button" onClick={() => setQuery('')} className="font-medium text-accent hover:underline">
                  Clear search
                </button>
              </p>
            ) : null}
            {activeArea ? (
              <>
                <SectionHeader
                  title={activeArea.area}
                  icon="mapPin"
                  subtitle={activeArea.levels ? `Levels: ${activeArea.levels}` : undefined}
                  action={<Badge tone="outline">{plural(activeArea.methods.length, 'method')}</Badge>}
                />
                {activeArea.methods.length === 0 ? (
                  <EmptyState
                    inline
                    icon="mapPin"
                    title="No encounter table for this filter"
                    description={
                      method === 'all'
                        ? `${activeArea.area} lists no encounter method in the wild tables.`
                        : `No ${method} encounter is documented in ${activeArea.area}.`
                    }
                    action={
                      method === 'all' ? undefined : (
                        <button
                          type="button"
                          onClick={() => setMethod('all')}
                          className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
                        >
                          Show every method
                        </button>
                      )
                    }
                  />
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {activeArea.methods.map((entry, index) => (
                      /*
                       * Keyed by position: an area may document the same method
                       * twice (Lake Verity lists two Surf tables).
                       */
                      <MethodBlock key={`${entry.method}-${index}`} method={entry} dexOf={dexOf} />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
