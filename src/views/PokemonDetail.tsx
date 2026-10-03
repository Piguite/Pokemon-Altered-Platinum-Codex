import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { dexLabel, plural, signed } from "../lib/format"
import { CHANGE_KIND_LABELS, CHANGE_KIND_ORDER, CHANGE_KIND_TONES } from "../lib/labels"
import { findPokemon, findSinnohan, loadPokemon, loadSinnohan, loadTypeChanges, useData } from "../lib/data"
import { resolveTypeChange } from "../lib/typechange"
import { Badge, Card, Delta } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { SectionHeader } from "../components/ui/SectionHeader"
import { SegmentedControl } from "../components/ui/Controls"
import { ShareButton } from "../components/ui/ShareButton"
import { Skeleton, SkeletonCard, SkeletonText } from "../components/ui/Skeleton"
import { Sprite } from "../components/ui/Sprite"
import { StatCompare } from "../components/ui/StatCompare"
import { TypeBadge, TypeChangeTag, TypeList, TypeTransition } from "../components/ui/TypeBadge"
import { BulletList, Callout, RawSections } from "../components/ui/Prose"
import { LearnsetExplorer, MoveNoteList } from "../components/pokemon/LearnsetExplorer"
import type { LearnsetTab, LevelSort } from "../components/pokemon/LearnsetExplorer"
import { EncounterAreas } from "../components/pokemon/EncounterAreas"
import { AlternateForms, FORM_CHANGE_NOTE_SECTION } from "../components/pokemon/AlternateForms"

type CompareMode = 'compare' | 'altered' | 'vanilla'

const MODE_OPTIONS: { value: CompareMode; label: string; icon: 'scale' | 'pokeball' | 'book' }[] = [
  { value: 'compare', label: 'Compare', icon: 'scale' },
  { value: 'altered', label: 'Altered', icon: 'pokeball' },
  { value: 'vanilla', label: 'Vanilla', icon: 'book' },
]

function statMode(mode: CompareMode): 'all' | 'old' | 'compare' {
  if (mode === 'vanilla') return 'old'
  if (mode === 'altered') return 'all'
  return 'compare'
}

/** Old → new pair of plain text values, honouring the compare mode. */
function Versus({ old, current, mode }: { old: string[]; current: string[]; mode: CompareMode }) {
  const oldText = old.join(' / ')
  const newText = current.join(' / ')
  if (mode === 'vanilla') return <span className="text-sm text-ink">{oldText}</span>
  if (mode === 'altered' || oldText === newText) return <span className="text-sm text-ink">{newText}</span>
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-faint line-through">{oldText}</span>
      <Icon name="arrowRight" size={14} className="text-ink-faint" />
      <span className="font-medium text-ink">{newText}</span>
    </span>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <SkeletonCard lines={2} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SkeletonText lines={14} />
        <SkeletonText lines={10} />
      </div>
    </div>
  )
}

export function PokemonDetail() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: pokemon, loading } = useData(loadPokemon)
  const { data: typeChanges } = useData(loadTypeChanges)
  const { data: sinnohan } = useData(loadSinnohan)

  const entry = useMemo(() => (pokemon ? findPokemon(pokemon, slug) : undefined), [pokemon, slug])

  /*
   * rev 3: a Sinnohan entry in PokemonChanges.txt documents no `type` of its
   * own — the form's typing lives in SinnohanForms.txt, so the matching form
   * supplies the change. `resolveTypeChange` keeps the documented pair as the
   * only source; `baseTypes` is never promoted to a change.
   */
  const sinnohanForm = useMemo(
    () => (entry?.isSinnohan && sinnohan ? findSinnohan(sinnohan, entry.slug) : undefined),
    [entry, sinnohan],
  )
  const typeChange = useMemo(() => (entry ? resolveTypeChange(entry, sinnohanForm) : undefined), [entry, sinnohanForm])
  const baseTypes = entry?.baseTypes ?? []

  const mode = (params.get('mode') as CompareMode) ?? 'compare'
  const safeMode: CompareMode = ['compare', 'altered', 'vanilla'].includes(mode) ? mode : 'compare'
  const tab = (params.get('tab') as LearnsetTab) ?? 'level'
  const sort = (params.get('sort') as LevelSort) ?? 'levelAsc'

  const justification = useMemo(
    () => (entry ? typeChanges?.pokemonChanges.find((item) => item.dex === entry.dex) : undefined),
    [entry, typeChanges],
  )

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  if (loading) return <DetailSkeleton />

  if (!entry) {
    return (
      <EmptyState
        icon="search"
        title="Pokémon not found"
        description={`No “${slug}” entry in PokemonChanges.txt.`}
        action={
          <Link to="/pokemon" className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink">
            Back to the Pokémon list
          </Link>
        }
      />
    )
  }

  const hasComparable = Boolean(entry.stats) || Boolean(typeChange) || Boolean(entry.ability)

  /*
   * rev 2: `baseStats` is the entry's *effective* spread in Altered Platinum and
   * is present even when the documents record no stat change at all (where it
   * comes from the vanilla Platinum baseline). Prefer the documented pair when
   * there is one, fall back to the baseline spread otherwise.
   */
  const effectiveStats = entry.baseStats ?? entry.stats?.new
  const baselineOnly = !entry.stats && entry.baseStatsSource === 'baseline'

  return (
    <div className="space-y-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <Link to="/pokemon" className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink">
          <Icon name="chevronLeft" size={13} />
          Modified Pokémon
        </Link>
        <span className="text-ink-faint">/</span>
        <span className="nums font-mono text-ink-faint">{dexLabel(entry.dex)}</span>
      </nav>

      {/* ------------------------------------------------------- Hero */}
      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start gap-4 sm:gap-6">
          <Sprite dex={entry.dex} name={entry.name} sinnohan={entry.isSinnohan} size={104} decorative={false} />
          {/*
            `min-w-[14rem]` on phones: the 104px sprite otherwise squeezes this
            column to ~120px, which shreds the type change into one chip per
            line. Below `sm` the column wraps under the sprite and gets the full
            card width; from `sm` up the layout is untouched.
          */}
          <div className="min-w-[14rem] flex-1 lg:min-w-0">
            <p className="nums font-mono text-xs text-ink-faint">{dexLabel(entry.dex)}</p>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{entry.name}</h1>
            <div className="mt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {typeChange ? (
                  <TypeTransition
                    oldTypes={typeChange.old}
                    newTypes={typeChange.new}
                    size="sm"
                    sideLabels
                    leading={<TypeChangeTag />}
                  />
                ) : (
                  /* rev 3: no documented change still leaves a typing to show —
                     the vanilla Gen-IV types, framed as reference values. */
                  <>
                    <span className="text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                      Types
                    </span>
                    <TypeList types={baseTypes} size="sm" />
                  </>
                )}
                {entry.isSinnohan ? <Badge tone="accent">Sinnohan form</Badge> : null}
              </div>
              {!typeChange ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                  This entry documents no type change: the types shown are the species’ vanilla
                  Generation-IV types.
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {CHANGE_KIND_ORDER.filter((kind) => entry.changeKinds.includes(kind)).map((kind) => (
                <Badge key={kind} tone={CHANGE_KIND_TONES[kind]}>
                  {CHANGE_KIND_LABELS[kind]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            {hasComparable ? (
              <SegmentedControl
                label="Comparison mode"
                options={MODE_OPTIONS}
                value={safeMode}
                onChange={(value) => update('mode', value)}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {entry.isSinnohan ? (
                <Link
                  to={`/sinnohan/${entry.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-accent/40 bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent"
                >
                  <Icon name="sparkles" size={14} />
                  Full Sinnohan entry
                </Link>
              ) : null}
              <ShareButton />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ----------------------------------------------- Main column */}
        <div className="min-w-0 space-y-5">
          {/* Stats */}
          {entry.stats ? (
            <Card>
              <SectionHeader
                eyebrow="Base stats"
                title="Base stats"
                icon="trending"
                action={
                  <span className="nums flex items-center gap-2 text-xs text-ink-muted">
                    <span className="font-mono">{entry.stats.old.bst}</span>
                    <Icon name="arrowRight" size={13} className="text-ink-faint" />
                    <span className="font-mono font-bold text-ink">{entry.stats.new.bst}</span>
                    <Delta value={entry.stats.new.bst - entry.stats.old.bst} />
                  </span>
                }
                className="mb-4"
              />
              <StatCompare old={entry.stats.old} new={entry.stats.new} mode={statMode(safeMode)} />

              {safeMode === 'compare' ? (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-6 rounded-pill bg-ink-faint/60" aria-hidden="true" /> Vanilla
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-6 rounded-pill bg-accent" aria-hidden="true" /> Altered Platinum
                    </span>
                  </div>
                  {(() => {
                    const changed = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).filter(
                      (key) => entry.stats && entry.stats.new[key] !== entry.stats.old[key],
                    )
                    return changed.length > 0 ? (
                      <p className="text-xs text-ink-muted">
                        {plural(changed.length, 'stat')} changed:{' '}
                        {changed
                          .map(
                            (key) =>
                              `${key.toUpperCase()} ${entry.stats ? `${entry.stats.old[key]}→${entry.stats.new[key]}` : ''}`,
                          )
                          .join(', ')}
                        .
                      </p>
                    ) : (
                      <p className="text-xs text-ink-muted">Same spread as the original game.</p>
                    )
                  })()}
                </div>
              ) : null}
            </Card>
          ) : effectiveStats ? (
            /*
             * No documented stat change: show the effective spread, sourced from
             * the vanilla Platinum baseline. Labelled, never presented as a hack
             * change.
             */
            <Card>
              <SectionHeader
                eyebrow="Base stats"
                title="Full spread"
                icon="trending"
                action={<Badge tone="outline">{effectiveStats.bst} BST</Badge>}
                subtitle="This entry documents no stat change: the spread below is the one from vanilla Pokémon Platinum."
                className="mb-4"
              />
              <StatCompare new={effectiveStats} mode="all" />
              {baselineOnly ? (
                <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
                  Reference values from vanilla Pokémon Platinum (PokeAPI), not from the hack's
                  documentation.
                </p>
              ) : null}
            </Card>
          ) : null}

          {/* Learnset */}
          <Card>
            <SectionHeader
              eyebrow="Learnsets"
              title="Learnsets"
              icon="zap"
              subtitle="(!!) marker: move newly available. (PLA) marker: move from Pokémon Legends: Arceus."
              className="mb-4"
            />
            <LearnsetExplorer
              learnset={entry.learnset}
              tab={tab}
              onTabChange={(value) => update('tab', value)}
              levelSort={sort}
              onLevelSortChange={(value) => update('sort', value)}
            />
          </Card>

          {/* Moves compatibility notes */}
          {entry.moves.length > 0 ? (
            <Card>
              <SectionHeader eyebrow="Compatibility" title="Move changes" icon="swap" className="mb-3" />
              <MoveNoteList notes={entry.moves} />
            </Card>
          ) : null}

          {/* Where to find it */}
          <EncounterAreas species={entry.name} sinnohan={entry.isSinnohan} />

          {/* Form variants */}
          {entry.forms.length > 0 ? <AlternateForms entry={entry} /> : null}

          <RawSections
            sections={entry.sections.filter((section) => section.title !== FORM_CHANGE_NOTE_SECTION)}
            title="Raw text for this entry"
          />
        </div>

        {/* ------------------------------------------------ Side column */}
        <aside className="min-w-0 space-y-4">
          <Card className="space-y-4">
            <h2 className="text-sm font-bold tracking-tight text-ink">Quick reference</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Types</dt>
                <dd>
                  {typeChange ? (
                    safeMode === 'vanilla' ? (
                      <TypeList types={typeChange.old} size="sm" />
                    ) : safeMode === 'altered' ? (
                      <TypeList types={typeChange.new} size="sm" />
                    ) : (
                      <TypeTransition
                        oldTypes={typeChange.old}
                        newTypes={typeChange.new}
                        size="sm"
                        sideLabels
                        leading={<TypeChangeTag />}
                      />
                    )
                  ) : (
                    <span className="block space-y-1">
                      <TypeList types={baseTypes} size="sm" />
                      <span className="block text-[11px] leading-relaxed text-ink-faint">
                        No type change documented: vanilla Generation-IV typing.
                      </span>
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Abilities</dt>
                <dd>
                  {entry.ability ? (
                    <Versus mode={safeMode} old={entry.ability.old} current={entry.ability.new} />
                  ) : (
                    <span className="text-xs text-ink-muted">Unchanged</span>
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">BST</dt>
                  <dd className="nums font-mono text-sm font-bold text-ink">
                    {effectiveStats?.bst ?? '—'}
                    {entry.stats && safeMode === 'compare' ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        ({signed(entry.stats.new.bst - entry.stats.old.bst)})
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                    Moves
                  </dt>
                  <dd className="nums font-mono text-sm font-bold text-ink">
                    {entry.learnset.levelUp.length + entry.learnset.tm.length + entry.learnset.tutor.length}
                  </dd>
                </div>
              </div>

              {entry.heldItem ? (
                <div>
                  <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                    Held item
                  </dt>
                  <dd className="text-sm text-ink">{entry.heldItem}</dd>
                </div>
              ) : null}
              {entry.baseHappiness ? (
                <div>
                  <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                    Base happiness
                  </dt>
                  <dd className="text-sm text-ink">{entry.baseHappiness}</dd>
                </div>
              ) : null}
              {entry.genderRatio ? (
                <div>
                  <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                    Gender ratio
                  </dt>
                  <dd className="text-sm text-ink">{entry.genderRatio}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {justification ? (
            <Card className="space-y-3">
              <SectionHeader eyebrow="Justification" title="Why this type change" icon="info" />
              <Callout tone="info">
                <p className="text-ink">{justification.justification}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex flex-wrap gap-1">
                    {justification.oldTypes.map((t) => (
                      <TypeBadge key={`o-${t}`} type={t} size="xs" />
                    ))}
                  </span>
                  <Icon name="arrowRight" size={12} className="text-ink-faint" />
                  <span className="inline-flex flex-wrap gap-1">
                    {justification.newTypes.map((t) => (
                      <TypeBadge key={`n-${t}`} type={t} size="xs" />
                    ))}
                  </span>
                </p>
              </Callout>
              <Link
                to="/types"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                See every type change <Icon name="arrowRight" size={13} />
              </Link>
            </Card>
          ) : null}

          {entry.evolution.length > 0 ? (
            <Card>
              <SectionHeader eyebrow="Evolution" title="Evolution lines" icon="shuffle" className="mb-3" />
              <BulletList lines={entry.evolution} icon="arrowRight" />
            </Card>
          ) : null}

          <Card className="space-y-2.5">
            <h2 className="text-sm font-bold tracking-tight text-ink">Go further</h2>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link to="/moves" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="zap" size={14} className="text-ink-faint" /> Replaced and new moves
                </Link>
              </li>
              <li>
                <Link to="/evolutions" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="shuffle" size={14} className="text-ink-faint" /> Evolution changes
                </Link>
              </li>
              <li>
                <Link to="/trainers" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="users" size={14} className="text-ink-faint" /> Trainers using this Pokémon
                </Link>
              </li>
              <li>
                <Link to="/wild" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="mapPin" size={14} className="text-ink-faint" /> Wild encounters
                </Link>
              </li>
            </ul>
            <p className="border-t border-line pt-2.5 text-[11px] text-ink-faint">
              {plural(entry.changeKinds.length, 'change kind')} documented.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
