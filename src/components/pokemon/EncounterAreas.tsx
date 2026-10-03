import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EncounterAreaGroup } from '../../lib/encounters'
import { groupByArea, useEncounterIndex } from '../../lib/encounters'
import { plural } from '../../lib/format'
import { wildAreaRoute } from '../../lib/routes'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { SectionHeader } from '../ui/SectionHeader'

function AreaRow({ group }: { group: EncounterAreaGroup }) {
  return (
    <li className="rounded-card border border-line bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          to={wildAreaRoute(group.area)}
          className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-accent"
        >
          <Icon name="mapPin" size={13} className="shrink-0 text-ink-faint" />
          <span className="min-w-0 break-words">{group.area}</span>
          <Icon name="chevronRight" size={13} className="shrink-0 text-ink-faint" />
        </Link>
        {group.levels ? (
          <span className="nums font-mono text-[11px] text-ink-faint">Lv. {group.levels}</span>
        ) : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {group.methods.map((hit, index) => (
          <li
            key={`${hit.method}-${hit.percent}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2 py-0.5 text-[11px]"
          >
            <span className="text-ink-muted">{hit.method}</span>
            <span className="nums font-mono font-semibold text-ink">{hit.percent}%</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

export interface EncounterAreasProps {
  /** Species name as the documents spell it (a "Sinnohan " prefix is stripped). */
  species: string
  sinnohan?: boolean
  className?: string
}

/**
 * "Where to find it" — every wild area a species shows up in, with the encounter
 * method and its slot percentage.
 *
 * Backed by a reverse index over `wild.json` (built once, see
 * `lib/encounters.ts`), so this stays a map lookup on a detail page. The
 * Sinnohan `(S)` convention is honoured: a regional form is matched against the
 * Sinnohan slots, a plain species against the plain ones.
 *
 * The list is complete — no "show more" truncation. Measured on the shipped
 * document the median species appears in 2 areas and the worst case (Gyarados)
 * in 25, so the block stays small while never hiding an area behind a click.
 */
export function EncounterAreas({ species, sinnohan = false, className }: EncounterAreasProps) {
  const lookup = useEncounterIndex()

  const name = useMemo(() => species.replace(/^Sinnohan\s+/i, '').replace(/\(S\)\s*$/i, '').trim(), [species])
  const hits = useMemo(() => (name ? lookup(name, sinnohan) : []), [lookup, name, sinnohan])
  const groups = useMemo(() => groupByArea(hits), [hits])

  return (
    <Card className={className}>
      <SectionHeader
        eyebrow="Encounters"
        title="Where to find it"
        icon="mapPin"
        action={
          groups.length > 0 ? (
            <Link to="/wild" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              Full table <Icon name="arrowRight" size={13} />
            </Link>
          ) : undefined
        }
        subtitle={
          groups.length > 0
            ? `${plural(groups.length, 'wild area')} where ${
                sinnohan ? 'this regional form' : 'this species'
              } appears, with the method and its encounter rate.`
            : undefined
        }
        className="mb-4"
      />

      {groups.length === 0 ? (
        <EmptyState
          inline
          icon="mapPin"
          title="No documented wild area"
          description={
            name
              ? `${name} does not appear in any WildPokemon.txt table: evolution, gift, trade or static encounter only.`
              : 'Unknown species.'
          }
              action={
            <Link
              to="/wild"
              className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-line-strong"
            >
              Browse the areas
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {groups.map((group) => (
            <AreaRow key={group.area} group={group} />
          ))}
        </ul>
      )}
    </Card>
  )
}
