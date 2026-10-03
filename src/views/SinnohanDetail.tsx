import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { PokemonChange } from "../types/data"
import { dexLabel, plural, statTotal } from "../lib/format"
import { findPokemon, findSinnohan, loadPokemon, loadSinnohan, useData } from "../lib/data"
import { sinnohanTypeChange } from "../lib/typechange"
import { Badge, Card, Delta } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { SectionHeader } from "../components/ui/SectionHeader"
import { ShareButton } from "../components/ui/ShareButton"
import { SkeletonCard, SkeletonText } from "../components/ui/Skeleton"
import { Sprite } from "../components/ui/Sprite"
import { StatCompare } from "../components/ui/StatCompare"
import { TypeChangeTag, TypeList, TypeTransition } from "../components/ui/TypeBadge"
import { BulletList, RawSections } from "../components/ui/Prose"
import { LearnsetExplorer } from "../components/pokemon/LearnsetExplorer"
import type { LearnsetTab, LevelSort } from "../components/pokemon/LearnsetExplorer"
import { EncounterAreas } from "../components/pokemon/EncounterAreas"
import type { TypeChangePair } from "../lib/typechange"

/**
 * The form's types are the headline; the vanilla typing of the species it
 * replaces is shown as the transition `was Dark → now Dark · +Steel`. Without
 * the enrichment the final typing alone is shown — never an empty arrow.
 */
function FormTypes({
  change,
  types,
  size = 'md',
  leading,
}: {
  change?: TypeChangePair
  types: string[]
  size?: 'sm' | 'md'
  leading?: ReactNode
}) {
  if (!change) return <TypeList types={types} size={size} />
  return (
    <TypeTransition
      oldTypes={change.old}
      newTypes={change.new}
      size={size}
      sideLabels
      leading={leading}
    />
  )
}

export function SinnohanDetail() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: forms, loading } = useData(loadSinnohan)
  const { data: pokemon } = useData(loadPokemon)

  const form = useMemo(() => (forms ? findSinnohan(forms, slug) : undefined), [forms, slug])

  const relatedEntry: PokemonChange | undefined = useMemo(() => {
    if (!pokemon || !form) return undefined
    return (
      findPokemon(pokemon, form.slug) ??
      pokemon.find((entry) => entry.isSinnohan && entry.slug === form.slug) ??
      pokemon.find((entry) => entry.isSinnohan && entry.dex === form.dex)
    )
  }, [pokemon, form])

  const tab = (params.get('tab') as LearnsetTab) ?? 'level'
  const sort = (params.get('sort') as LevelSort) ?? 'levelAsc'

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SkeletonText lines={12} />
          <SkeletonText lines={8} />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <EmptyState
        icon="sparkles"
        title="Sinnohan form not found"
        description={`No “${slug}” entry in SinnohanForms.txt.`}
        action={
          <Link to="/sinnohan" className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink">
            Back to the Sinnohan gallery
          </Link>
        }
      />
    )
  }

  const total = form.stats.bst || statTotal(form.stats)
  const replacedTotal = form.replacedStats ? form.replacedStats.bst || statTotal(form.replacedStats) : null
  /* All 65 forms replace the original species' typing — the change is the headline. */
  const typeChange = sinnohanTypeChange(form)

  return (
    <div className="space-y-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <Link to="/sinnohan" className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink">
          <Icon name="chevronLeft" size={13} />
          Sinnohan forms
        </Link>
        <span className="text-ink-faint">/</span>
        <span className="nums font-mono text-ink-faint">{dexLabel(form.dex)}</span>
      </nav>

      <header className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start gap-4 sm:gap-6">
          <Sprite dex={form.dex} name={form.name} sinnohan size={104} decorative={false} />
          {/* Same phone treatment as PokemonDetail: the type change keeps the
              full card width instead of a ~120px gutter beside the sprite. */}
          <div className="min-w-[14rem] flex-1 lg:min-w-0">
            <p className="nums mt-1.5 font-mono text-xs text-ink-faint">
              {dexLabel(form.dex)} · original species: {form.baseName}
            </p>
            <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              {form.name}
              <Badge tone="form">Regional form</Badge>
            </h1>
            <div className="mt-2.5">
              {typeChange ? (
                <FormTypes change={typeChange} types={form.types} size="md" leading={<TypeChangeTag />} />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                    Types
                  </span>
                  <TypeList types={form.types} size="md" />
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Abilities: <span className="text-ink">{form.abilities.join(' / ') || '—'}</span>
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="nums flex items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-2.5">
              <span className="text-right">
                <span className="block text-[10px] tracking-[0.1em] text-ink-faint uppercase">BST</span>
                <span className="block font-mono text-xl font-extrabold text-ink">{total}</span>
              </span>
            </div>
            <ShareButton />
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader
              eyebrow="Base stats"
              title="Full spread"
              icon="trending"
              action={
                replacedTotal !== null ? (
                  <span className="nums flex items-center gap-2 text-xs text-ink-muted">
                    <span className="font-mono">{replacedTotal}</span>
                    <Icon name="arrowRight" size={13} className="text-ink-faint" />
                    <span className="font-mono font-bold text-ink">{total}</span>
                    <Delta value={total - replacedTotal} />
                  </span>
                ) : (
                  <Badge tone="outline">{total} BST</Badge>
                )
              }
              subtitle={
                form.replacedStats
                  ? `Compared with ${form.baseName} in Pokémon Platinum: this form's stats replace those of the original species.`
                  : 'This form’s stats are specific to Altered Platinum: no original version exists.'
              }
              className="mb-4"
            />
            {form.replacedStats ? (
              <StatCompare old={form.replacedStats} new={form.stats} mode="compare" />
            ) : (
              <StatCompare new={form.stats} mode="all" />
            )}
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Learnsets"
              title="Learnsets"
              icon="zap"
              className="mb-4"
            />
            <LearnsetExplorer
              learnset={form.learnset}
              tab={tab}
              onTabChange={(value) => update('tab', value)}
              levelSort={sort}
              onLevelSortChange={(value) => update('sort', value)}
            />
          </Card>

          <EncounterAreas species={form.baseName} sinnohan />

          <RawSections sections={form.sections} title="Raw text for this form" />
        </div>

        <aside className="min-w-0 space-y-4">
          <Card className="space-y-4">
            <h2 className="text-sm font-bold tracking-tight text-ink">Quick reference</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Types</dt>
                <dd>
                  <FormTypes change={typeChange} types={form.types} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Abilities</dt>
                <dd className="text-ink">{form.abilities.join(' / ') || '—'}</dd>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map((key) => (
                  <div key={key} className="flex items-center justify-between border-b border-line pb-1">
                    <dt className="font-mono text-[11px] text-ink-faint uppercase">{key === 'spa' ? 'SAtk' : key === 'spd' ? 'SDef' : key}</dt>
                    <dd className="nums font-mono text-sm font-semibold text-ink">{form.stats[key]}</dd>
                  </div>
                ))}
              </div>
              <div>
                <dt className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                  Documented moves
                </dt>
                <dd className="nums font-mono text-sm font-bold text-ink">
                  {form.learnset.levelUp.length + form.learnset.tm.length + form.learnset.tutor.length}
                </dd>
              </div>
            </dl>
          </Card>

          {form.evolution.length > 0 ? (
            <Card>
              <SectionHeader eyebrow="Evolution" title="Evolution line" icon="shuffle" className="mb-3" />
              <BulletList lines={form.evolution} icon="arrowRight" />
            </Card>
          ) : null}

          {relatedEntry ? (
            <Card className="space-y-3">
              <h2 className="text-sm font-bold tracking-tight text-ink">PokemonChanges entry</h2>
              <p className="text-xs leading-relaxed text-ink-muted">
                This form also has an entry in PokemonChanges.txt, with its{' '}
                {plural(relatedEntry.changeKinds.length, 'change kind')} detailed.
              </p>
              <Link
                to={`/pokemon/${relatedEntry.slug}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
              >
                Compare with the Pokémon entry <Icon name="arrowRight" size={13} />
              </Link>
            </Card>
          ) : null}

          <Card className="space-y-2.5">
            <h2 className="text-sm font-bold tracking-tight text-ink">Building a team</h2>
            <p className="text-xs leading-relaxed text-ink-muted">
              Sinnohan forms replace the original species: check the wild encounters and the trainer
              rosters before building your team.
            </p>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link to="/wild" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="mapPin" size={14} className="text-ink-faint" /> Wild encounters
                </Link>
              </li>
              <li>
                <Link to="/trainers" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="users" size={14} className="text-ink-faint" /> Trainer rosters
                </Link>
              </li>
              <li>
                <Link to="/evolutions" className="flex items-center gap-2 text-ink-muted transition-colors hover:text-ink">
                  <Icon name="shuffle" size={14} className="text-ink-faint" /> Evolution methods
                </Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
