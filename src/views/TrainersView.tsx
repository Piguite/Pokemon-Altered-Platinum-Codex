import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { BossDetail, TeamSlot, TrainerArea, TrainerEntry } from "../types/data"
import { cls, matches, plural } from "../lib/format"
import { loadTrainers, useData } from "../lib/data"
import { speciesRoute } from "../lib/routes"
import { useSpeciesDex } from "../lib/useSpeciesDex"
import { Badge, Card } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SearchField } from "../components/ui/Controls"
import { Tabs } from "../components/ui/Tabs"
import { SkeletonRows, SkeletonText } from "../components/ui/Skeleton"
import { Sprite } from "../components/ui/Sprite"
import { BulletList, Callout } from "../components/ui/Prose"

type DexLookup = (species: string, sinnohan: boolean) => number | undefined

/**
 * One roster slot: sprite + name + level.
 *
 * Route trainers used to be a bare text list while only boss teams had sprites;
 * both now share the same treatment. The chip links to the species page when the
 * dex index resolves it, and degrades to plain text when it does not (a species
 * missing from both documents has no page to open).
 */
function SpeciesChip({
  slot,
  dexOf,
  size = 28,
}: {
  slot: TeamSlot
  dexOf: DexLookup
  size?: number
}) {
  const dex = dexOf(slot.species, slot.isSinnohan)
  const base =
    'inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 py-[2px] pr-2 pl-[2px] text-xs'
  const content = (
    <>
      <Sprite dex={dex} name={slot.species} sinnohan={slot.isSinnohan} size={size} />
      <span className="text-ink">{slot.species}</span>
      {slot.isSinnohan ? (
        <span className="font-mono text-[10px] font-bold text-accent" title="Sinnohan form">
          (S)
        </span>
      ) : null}
      <span className="nums font-mono text-[10px] text-ink-faint">Lv.{slot.level}</span>
    </>
  )

  if (typeof dex !== 'number') return <span className={base}>{content}</span>

  return (
    <Link
      to={speciesRoute(slot.species, slot.isSinnohan)}
      title={`${slot.species} entry`}
      className={cls(base, 'transition-colors hover:border-line-strong hover:bg-surface-3')}
    >
      {content}
    </Link>
  )
}

function TeamList({ entry, dexOf }: { entry: TrainerEntry; dexOf: DexLookup }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.team.map((slot, index) => (
        <SpeciesChip key={`${slot.species}-${index}`} slot={slot} dexOf={dexOf} />
      ))}
      {entry.team.length === 0 ? <span className="text-xs text-ink-faint">—</span> : null}
    </div>
  )
}

function TrainerRow({ entry, dexOf }: { entry: TrainerEntry; dexOf: DexLookup }) {
  return (
    <li className="space-y-1.5 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{entry.name}</span>
        {entry.markers.map((marker) => (
          <Badge key={marker} tone="outline" mono>
            {marker}
          </Badge>
        ))}
      </div>
      <TeamList entry={entry} dexOf={dexOf} />
    </li>
  )
}

function BossCard({ boss, dexOf }: { boss: BossDetail; dexOf: DexLookup }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
        <Icon name="star" size={15} className="text-warn" />
        <h3 className="text-sm font-bold tracking-tight text-ink">{boss.name}</h3>
        <span className="nums ml-auto font-mono text-[11px] text-ink-faint">
          {plural(boss.team.length, 'Pokémon')}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {boss.team.map((slot, index) => (
          <li key={`${slot.species}-${index}`} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <Sprite dex={dexOf(slot.species, slot.isSinnohan)} name={slot.species} sinnohan={slot.isSinnohan} size={44} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  to={speciesRoute(slot.species, slot.isSinnohan)}
                  className="text-sm font-semibold text-ink transition-colors hover:text-accent"
                >
                  {slot.species}
                </Link>
                {slot.isSinnohan ? <Badge tone="accent">S</Badge> : null}
                <span className="nums font-mono text-xs text-ink-faint">Lv.{slot.level}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {slot.item ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted"
                    title="Held item"
                  >
                    <Icon name="tag" size={11} className="text-ink-faint" />
                    {slot.item}
                  </span>
                ) : null}
                {slot.ability ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-pill border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent"
                    title="Ability"
                  >
                    <Icon name="sparkles" size={11} />
                    {slot.ability}
                  </span>
                ) : null}
              </div>
              {slot.moves.length > 0 ? (
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {slot.moves.map((move, moveIndex) => (
                    <li
                      key={`${move}-${moveIndex}`}
                      className="flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink-muted"
                    >
                      <Icon name="zap" size={11} className="shrink-0 text-ink-faint" />
                      <span className="truncate">{move}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Trainers rendered before the "show more" control: a route can list dozens. */
const TRAINER_PAGE = 20

function AreaPanel({ area, dexOf }: { area: TrainerArea; dexOf: DexLookup }) {
  const [tab, setTab] = useState('bosses')
  const [trainerLimit, setTrainerLimit] = useState(TRAINER_PAGE)
  const hasRematches = area.rematches.length > 0
  const tabs = [
    { id: 'bosses', label: 'Bosses', count: area.bosses.length },
    { id: 'trainers', label: 'Trainers', count: area.trainers.length },
    { id: 'rematches', label: 'Rematches', count: area.rematches.length },
  ].filter((entry) => entry.count > 0 || entry.id === 'bosses' || entry.id === 'trainers')

  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : (tabs[0]?.id ?? 'bosses')
  const visibleTrainers = area.trainers.slice(0, trainerLimit)

  return (
    <div className="space-y-4">
      <SectionHeader
        title={area.area}
        icon="mapPin"
        subtitle={`${plural(area.trainers.length, 'trainer')} · ${plural(area.bosses.length, 'boss fight')}${
          hasRematches ? ` · ${plural(area.rematches.length, 'rematch', 'rematches')}` : ''
        }`}
      />

      <Tabs label="Trainer categories" value={activeTab} onChange={setTab} tabs={tabs} size="sm" />

      {activeTab === 'bosses' ? (
        area.bosses.length === 0 ? (
          <EmptyState inline icon="users" title="No boss fight documented" description="This area only holds regular trainers." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {area.bosses.map((boss) => (
              <BossCard key={boss.name} boss={boss} dexOf={dexOf} />
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'trainers' ? (
        area.trainers.length === 0 ? (
          <EmptyState inline icon="users" title="No trainer listed" />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <ul>
              {visibleTrainers.map((entry, index) => (
                <TrainerRow key={`${entry.name}-${index}`} entry={entry} dexOf={dexOf} />
              ))}
            </ul>
            {area.trainers.length > visibleTrainers.length ? (
              <div className="flex justify-center border-t border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => setTrainerLimit((value) => value + TRAINER_PAGE)}
                  className="rounded-pill border border-line-strong bg-surface-2 px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-ink-faint"
                >
                  Show {Math.min(TRAINER_PAGE, area.trainers.length - visibleTrainers.length)} more trainers
                </button>
              </div>
            ) : null}
          </Card>
        )
      ) : null}

      {activeTab === 'rematches' ? (
        <Card padded={false} className="overflow-hidden">
          <ul>
            {area.rematches.map((entry, index) => (
              <TrainerRow key={`${entry.name}-${index}`} entry={entry} dexOf={dexOf} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

export function TrainersView() {
  const { data: doc, loading } = useData(loadTrainers)
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const selected = params.get('area')

  const areas = doc?.areas ?? []
  const dexOf = useSpeciesDex()

  /** The selected area lives in the URL so any roster is shareable. */
  function selectArea(name: string) {
    const next = new URLSearchParams(params)
    next.set('area', name)
    setParams(next, { replace: true })
  }

  const needle = query.trim()

  /**
   * The areas the search keeps, plus whether it matched at least one area *by
   * its own name*.
   *
   * The flag is what keeps the "selection hidden" notice honest: a search for a
   * Pokémon ("scyther") or a trainer matches areas through their rosters, never
   * by zone name, so there is no zone the results could disagree with and the
   * notice must stay silent.
   */
  const { areas: filteredAreas, nameMatched } = useMemo(() => {
    if (!needle) return { areas, nameMatched: false }
    const list = areas.filter((area) => {
      if (matches(area.area, needle)) return true
      const trainerHit = [...area.trainers, ...area.rematches].some(
        (entry) =>
          matches(entry.name, needle) || entry.team.some((slot) => matches(slot.species, needle)),
      )
      if (trainerHit) return true
      return area.bosses.some(
        (boss) => matches(boss.name, needle) || boss.team.some((slot) => matches(slot.species, needle)),
      )
    })
    return { areas: list, nameMatched: list.some((area) => matches(area.area, needle)) }
  }, [areas, needle])

  const activeArea = useMemo(
    () => (selected ? filteredAreas.find((area) => area.area === selected) : undefined) ?? filteredAreas[0],
    [filteredAreas, selected],
  )

  /*
   * A specific area was requested (deep link or search result) and a search for
   * *zone names* hides it: the panel still shows a real area and says which one,
   * so it never silently disagrees with what was clicked. A Pokémon or trainer
   * search is not a zone search and raises no notice at all.
   */
  const selectionHidden =
    Boolean(selected) && nameMatched && !filteredAreas.some((area) => area.area === selected)

  /** Keep the requested area visible in the (scrollable) zone list. */
  const activeRowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!selected) return
    activeRowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  const totalTrainers = useMemo(
    () => areas.reduce((sum, area) => sum + area.trainers.length + area.rematches.length, 0),
    [areas],
  )
  const totalBosses = useMemo(() => areas.reduce((sum, area) => sum + area.bosses.length, 0), [areas])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trainers"
        subtitle="Rosters by area, Vs. Seeker rematches and full entries for the important fights (held item, ability and four moves per Pokémon)."
        meta={
          <>
            <Badge tone="accent">{plural(areas.length, 'area')}</Badge>
            <Badge tone="outline">{plural(totalTrainers, 'trainer')}</Badge>
            <Badge tone="outline">{plural(totalBosses, 'detailed boss', 'detailed bosses')}</Badge>
          </>
        }
      />

      {(doc?.levelCaps.length ?? 0) > 0 ? (
        <Card>
          <SectionHeader
            eyebrow="Landmarks"
            title="Level caps"
            icon="trending"
            subtitle="Levels of the important trainers, to plan your progression."
            action={
              <a
                href="#/guides/level-caps"
                className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Detailed view <Icon name="arrowRight" size={13} />
              </a>
            }
            className="mb-3"
          />
          <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(doc?.levelCaps ?? []).map((cap) => {
              const match = /^(.*?),\s*Lv\.\s*(\d+)/.exec(cap)
              return (
                <li
                  key={cap}
                  className="shrink-0 rounded-card border border-line bg-surface-2 px-3 py-2 text-center"
                >
                  <p className="nums font-mono text-lg font-bold text-ink">{match ? match[2] : '—'}</p>
                  <p className="max-w-[9rem] truncate text-[11px] text-ink-muted">
                    {match ? match[1] : cap}
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {(doc?.generalNotes.length ?? 0) > 0 ? (
        <Callout tone="info" title="How to read the tables">
          <BulletList lines={doc?.generalNotes ?? []} icon={null} dense />
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <SearchField
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            label="Search for an area, a trainer or a Pokémon"
            placeholder="Area, trainer, Pokémon…"
          />
          <div className="rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Areas</h2>
              <span className="nums font-mono text-[11px] text-ink-faint">
                {filteredAreas.length}/{areas.length}
              </span>
            </div>
            <ul className="scroll-thin max-h-[32rem] overflow-y-auto p-1.5">
              {filteredAreas.map((area, index) => {
                const active = activeArea?.area === area.area
                const bossMarker = area.bosses.length > 0
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
                      {bossMarker ? (
                        <Icon name="star" size={13} className="shrink-0 text-warn" />
                      ) : (
                        <Icon name="mapPin" size={13} className="shrink-0 text-ink-faint" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{area.area}</span>
                      <span className="nums shrink-0 font-mono text-[10px] text-ink-faint">
                        {area.trainers.length + area.rematches.length}
                      </span>
                    </button>
                  </li>
                )
              })}
              {filteredAreas.length === 0 ? (
                <li className="px-3 py-8 text-center text-xs text-ink-faint">No area matches.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {selectionHidden ? (
            <p
              data-notice="zone-search-hidden"
              className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted"
            >
              <Icon name="info" size={13} className="shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1">
                The selected zone “{selected}” isn’t part of this search: the panel below is{' '}
                {activeArea?.area ?? 'the first matching zone'}, the first zone that matches.
              </span>
              <button type="button" onClick={() => setQuery('')} className="font-medium text-accent hover:underline">
                Clear search
              </button>
            </p>
          ) : null}
          {loading ? (
            <div className="space-y-4">
              <SkeletonText lines={3} />
              <SkeletonRows rows={6} />
            </div>
          ) : activeArea ? (
            <AreaPanel area={activeArea} dexOf={dexOf} />
          ) : (
            <EmptyState
              icon="users"
              title="No area matches"
              description="Try another area, trainer or Pokémon name."
            />
          )}
        </div>
      </div>
    </div>
  )
}
