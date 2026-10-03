import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PType } from "../types/data"
import { cls, matches, plural } from "../lib/format"
import { keyOf, loadTypeChanges, useData } from "../lib/data"
import { baseMultiplier, formatMultiplier, readableInk, resolveChart, typeColor, TYPE_ORDER } from "../lib/typechart"
import { Badge, Card } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SegmentedControl, SearchField, Toolbar } from "../components/ui/Controls"
import { SkeletonRows, SkeletonText } from "../components/ui/Skeleton"
import { TypeBadge, TypeTransition } from "../components/ui/TypeBadge"
import { BulletList, Callout } from "../components/ui/Prose"
import typeChartImage from '../../data/source/typechart_new.png'

type MatrixMode = 'altered' | 'vanilla' | 'diff'

const MODE_OPTIONS: { value: MatrixMode; label: string }[] = [
  { value: 'altered', label: 'Altered' },
  { value: 'vanilla', label: 'Vanilla' },
  { value: 'diff', label: 'Differences' },
]

function multiplierText(m: number): string {
  if (m === 0) return '0'
  if (m === 0.5) return '½'
  if (m === 2) return '2'
  return '1'
}

/** Blends a multiplier into a background colour that survives both themes. */
function cellStyle(multiplier: number): { backgroundColor: string; color: string } {
  if (multiplier === 0) return { backgroundColor: 'var(--color-surface-3)', color: 'var(--color-ink-faint)' }
  if (multiplier === 0.5) return { backgroundColor: 'color-mix(in srgb, var(--color-good) 22%, transparent)', color: 'var(--color-good-ink)' }
  if (multiplier === 2) return { backgroundColor: 'color-mix(in srgb, var(--color-bad) 22%, transparent)', color: 'var(--color-bad-ink)' }
  if (multiplier === 0.25) return { backgroundColor: 'color-mix(in srgb, var(--color-good) 34%, transparent)', color: 'var(--color-good-ink)' }
  if (multiplier === 4) return { backgroundColor: 'color-mix(in srgb, var(--color-bad) 34%, transparent)', color: 'var(--color-bad-ink)' }
  return { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-faint)' }
}

interface Selected {
  attacker: string
  defender: string
}

function MatrixCell({
  attacker,
  defender,
  multiplier,
  vanilla,
  changed,
  selected,
  onSelect,
}: {
  attacker: string
  defender: string
  multiplier: number
  vanilla: number
  changed: boolean
  selected: boolean
  onSelect: () => void
}) {
  const style = cellStyle(multiplier)
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${attacker} → ${defender}: ${formatMultiplier(multiplier)}${changed ? ` (vanilla: ${formatMultiplier(vanilla)})` : ''}`}
      aria-label={`${attacker} against ${defender}: ${formatMultiplier(multiplier)}${changed ? `, changed from ${formatMultiplier(vanilla)}` : ''}`}
      className={cls(
        'nums grid h-9 w-9 place-items-center font-mono text-[11.5px] font-semibold transition-[transform,box-shadow] duration-150',
        'hover:z-20 hover:scale-110 hover:shadow-card',
        changed && 'ring-2 ring-accent ring-inset',
        selected && 'z-10 ring-2 ring-info ring-inset',
      )}
      style={style}
    >
      {multiplierText(multiplier)}
    </button>
  )
}

export function TypesView() {
  const { data: doc, loading } = useData(loadTypeChanges)
  const [mode, setMode] = useState<MatrixMode>('altered')
  const [focusIce, setFocusIce] = useState(false)
  const [selected, setSelected] = useState<Selected | null>({ attacker: 'Ground', defender: 'Ice' })
  const [query, setQuery] = useState('')

  const chart = useMemo(() => resolveChart(doc?.chartChanges), [doc])

  const changedPairs = useMemo(
    () => new Set((doc?.chartChanges ?? []).map((change) => `${change.attacker}|${change.defender}`)),
    [doc],
  )

  const attackers = useMemo(() => {
    if (!focusIce) return TYPE_ORDER
    const set = new Set((doc?.chartChanges ?? []).map((change) => change.attacker))
    return TYPE_ORDER.filter((type) => set.has(type))
  }, [focusIce, doc])

  const defenders = useMemo(() => {
    if (!focusIce) return TYPE_ORDER
    const set = new Set((doc?.chartChanges ?? []).map((change) => change.defender))
    return TYPE_ORDER.filter((type) => set.has(type))
  }, [focusIce, doc])

  const pokemonChanges = useMemo(() => {
    const list = doc?.pokemonChanges ?? []
    if (!query.trim()) return list
    return list.filter((entry) =>
      matches(`${entry.name} ${entry.oldTypes.join(' ')} ${entry.newTypes.join(' ')} ${entry.justification}`, query),
    )
  }, [doc, query])

  const selectedMultiplier = selected
    ? (mode === 'vanilla' ? chart.vanilla : chart.altered).get(`${selected.attacker}|${selected.defender}`)
    : undefined
  const selectedVanilla = selected ? chart.vanilla.get(`${selected.attacker}|${selected.defender}`) : undefined
  const selectedOverride = selected ? chart.overrides.get(`${selected.attacker}|${selected.defender}`) : undefined
  const selectedIsChanged = selected ? changedPairs.has(`${selected.attacker}|${selected.defender}`) : false

  return (
    <div className="space-y-8">
      <PageHeader
        title="Types & type chart"
        subtitle="Fairy replaces ???, Steel takes Dark and Ghost attacks at 1×, and above all: the Ice type has been entirely reworked. The 69 Pokémon whose type changes are listed below, each with the author's justification."
        meta={
          <>
            <Badge tone="accent">{plural(doc?.chartChanges.length ?? 0, 'modified cell')}</Badge>
            <Badge tone="outline">{plural(doc?.pokemonChanges.length ?? 0, 'type change')}</Badge>
            <Badge tone="outline">Ice is the only change on the chart</Badge>
          </>
        }
      />

      {/* ------------------------------------------------ Ice rework */}
      <section aria-labelledby="ice-rework" className="space-y-4">
        <SectionHeader
          id="ice-rework"
          eyebrow="Ice rework"
          title="The Ice type reworked"
          icon="snowflake"
          subtitle="The only four cells of the type chart the hack changes."
        />
        {loading ? (
          <SkeletonText lines={4} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="grid gap-3 sm:grid-cols-2">
              {(doc?.chartChanges ?? []).map((change) => {
                const direction = change.newMultiplier < change.oldMultiplier ? 'down' : 'up'
                return (
                  <Card key={`${change.attacker}-${change.defender}`} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <TypeBadge type={change.attacker} size="sm" />
                        <Icon name="arrowRight" size={13} className="text-ink-faint" />
                        <TypeBadge type={change.defender} size="sm" />
                      </span>
                      <Badge tone={direction === 'down' ? 'good' : 'bad'}>
                        {formatMultiplier(change.oldMultiplier)} → {formatMultiplier(change.newMultiplier)}
                      </Badge>
                    </div>
                    {change.note ? <p className="text-xs leading-relaxed text-ink-muted">{change.note}</p> : null}
                  </Card>
                )
              })}
            </div>
            <Card className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Why Ice only?</h3>
              <BulletList lines={doc?.iceTypeNotes ?? []} dense />
            </Card>
          </div>
        )}
      </section>

      {/* -------------------------------------------------- Matrix */}
      <section aria-labelledby="matrix" className="space-y-4">
        <SectionHeader
          id="matrix"
          eyebrow="Interactive chart"
          title="The 18-type matrix"
          icon="grid"
          subtitle="Rows = attacking type, columns = defending type. Click a cell to see the detail and its justification."
          action={
            <SegmentedControl
              label="Type chart version"
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
            />
          }
        />

        <Callout tone="info">
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded font-mono text-[10px] font-bold" style={cellStyle(2)}>
                2
              </span>
              Super effective
            </span>
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded font-mono text-[10px] font-bold" style={cellStyle(1)}>
                1
              </span>
              Neutral
            </span>
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded font-mono text-[10px] font-bold" style={cellStyle(0.5)}>
                ½
              </span>
              Resisted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded font-mono text-[10px] font-bold" style={cellStyle(0)}>
                0
              </span>
              Immune
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-4 rounded ring-2 ring-accent ring-inset" aria-hidden="true" />
              Cell changed by the hack
            </span>
          </span>
        </Callout>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={focusIce}
            onClick={() => setFocusIce((value) => !value)}
            className={cls(
              'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
              focusIce ? 'border-transparent bg-accent-solid text-accent-ink' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
            )}
          >
            <Icon name="snowflake" size={14} />
            {focusIce ? 'Show all 18 types' : 'Show only changed cells'}
          </button>
          {mode === 'diff' ? (
            <span className="text-xs text-ink-muted">
              Differences mode: {plural(changedPairs.size, 'cell')} flagged as different from the original
              chart.
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="scroll-thin max-h-[72vh] overflow-auto">
            <table className="border-separate border-spacing-0 text-xs">
              <caption className="sr-only">
                Full type chart. Rows: attacking type. Columns: defending type.
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 left-0 z-30 border-r border-b border-line bg-surface-2 px-2 py-2 text-left text-[10px] font-semibold tracking-wide text-ink-faint uppercase"
                  >
                    Atk. \ Def.
                  </th>
                  {defenders.map((defender) => (
                    <th
                      key={defender}
                      scope="col"
                      className="sticky top-0 z-20 border-b border-line bg-surface-2 p-0.5"
                    >
                      <span
                        className="grid h-7 w-9 place-items-center rounded text-[10px] font-bold tracking-wide"
                        style={{ backgroundColor: typeColor(defender), color: readableInk(typeColor(defender)) }}
                        title={defender}
                      >
                        {defender.slice(0, 4)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attackers.map((attacker) => (
                  <tr key={attacker}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b border-line bg-surface-2 p-0.5 text-left"
                    >
                      <span
                        className="flex h-8 w-[7.25rem] items-center rounded px-2 text-[11.5px] font-bold tracking-wide"
                        style={{ backgroundColor: typeColor(attacker), color: readableInk(typeColor(attacker)) }}
                      >
                        {attacker}
                      </span>
                    </th>
                    {defenders.map((defender) => {
                      const key = `${attacker}|${defender}`
                      const altered = chart.altered.get(key) ?? baseMultiplier(attacker as PType, defender as PType)
                      const vanilla = chart.vanilla.get(key) ?? altered
                      const value = mode === 'vanilla' ? vanilla : altered
                      return (
                        <td key={defender} className="border-b border-l border-line p-0">
                          <MatrixCell
                            attacker={attacker}
                            defender={defender}
                            multiplier={value}
                            vanilla={vanilla}
                            changed={changedPairs.has(key)}
                            selected={selected?.attacker === attacker && selected?.defender === defender}
                            onSelect={() => setSelected({ attacker, defender })}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected cell detail */}
        {selected ? (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={selected.attacker} size="md" />
                <Icon name="arrowRight" size={16} className="text-ink-faint" />
                <TypeBadge type={selected.defender} size="md" />
              </div>
              <div className="flex items-center gap-2">
                {selectedIsChanged ? (
                  <>
                    <Badge tone="neutral">Vanilla {formatMultiplier(selectedVanilla ?? 1)}</Badge>
                    <Badge tone="accent">Altered {formatMultiplier(selectedMultiplier ?? 1)}</Badge>
                  </>
                ) : (
                  <Badge tone="outline">Unchanged · {formatMultiplier(selectedMultiplier ?? 1)}</Badge>
                )}
              </div>
            </div>
            {selectedOverride?.note ? (
              <p className="text-sm leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink">Justification: </span>
                {selectedOverride.note}
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                This cell is not documented as changed: it keeps the value from the original chart.
              </p>
            )}
          </Card>
        ) : null}
      </section>

      {/* ---------------------------------------- 69 pokemon changes */}
      <section aria-labelledby="pokemon-changes" className="space-y-4">
        <SectionHeader
          id="pokemon-changes"
          eyebrow="TypeChanges.txt"
          title="Type changes by Pokémon"
          icon="pokeball"
          subtitle="Each row shows the old type, the new type and the justification given by the author."
        />
        <Toolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            label="Search for a type change"
            placeholder="Name, type or justification…"
            className="sm:max-w-md sm:flex-1"
          />
          <span className="nums shrink-0 text-xs text-ink-muted">
            {pokemonChanges.length} / {doc?.pokemonChanges.length ?? 0}
          </span>
        </Toolbar>

        {loading ? (
          <SkeletonRows rows={8} />
        ) : pokemonChanges.length === 0 ? (
          <EmptyState icon="search" title="No change matches" description="Try another name or type." />
        ) : (
          <ul className="space-y-2">
            {pokemonChanges.map((entry) => (
              <li key={`${entry.dex}-${entry.name}`}>
                <Card padded={false}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="w-16 shrink-0">
                      <span className="nums font-mono text-xs text-ink-faint">#{String(entry.dex).padStart(3, '0')}</span>
                    </div>
                    <div className="w-44 shrink-0">
                      <Link to={`/pokemon/${keyOf(entry.name)}`} className="text-sm font-semibold text-ink hover:text-accent">
                        {entry.name}
                      </Link>
                    </div>
                    <div className="shrink-0">
                      <TypeTransition oldTypes={entry.oldTypes} newTypes={entry.newTypes} size="xs" />
                    </div>
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted sm:text-right sm:text-left">
                      {entry.justification}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------- Rationales + notes */}
      <section aria-labelledby="general-notes" className="grid gap-5 lg:grid-cols-2">
        <div id="general-notes" className="space-y-4">
          <SectionHeader title="General notes" icon="info" />
          <BulletList lines={doc?.generalNotes ?? []} />
        </div>
        {(doc?.rationales.length ?? 0) > 0 ? (
          <div className="space-y-4">
            <SectionHeader title="Rationale by type" icon="scale" />
            <div className="space-y-3">
              {(doc?.rationales ?? []).map((rationale) => (
                <Card key={rationale.type} className="space-y-2">
                  <TypeBadge type={rationale.type} size="sm" />
                  <p className="text-sm leading-relaxed text-ink-muted">{rationale.text}</p>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------ Author chart */}
      <section aria-labelledby="original-chart" className="space-y-4">
        <SectionHeader
          id="original-chart"
          eyebrow="Reference"
          title="The author's original type chart"
          icon="book"
          subtitle="The image shipped with the hack's documentation, for visual checking."
        />
        <Card padded={false} className="overflow-hidden">
          <a href={typeChartImage} target="_blank" rel="noreferrer" className="block">
            <img
              src={typeChartImage}
              alt="Official type chart shipped with Altered Platinum"
              loading="lazy"
              className="mx-auto max-h-[32rem] w-auto bg-surface-2 object-contain p-2"
            />
          </a>
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-ink-muted">
            <Icon name="external" size={13} className="text-ink-faint" />
            Click to open the image at full resolution.
          </p>
        </Card>
      </section>
    </div>
  )
}
