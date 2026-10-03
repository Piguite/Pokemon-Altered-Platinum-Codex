import { Link } from 'react-router-dom'
import type { FormVariant, PokemonChange } from "../../types/data"
import { plural } from "../../lib/format"
import { useSpeciesEvents } from "../../lib/events"
import { Badge, Card, Delta } from "../ui/Card"
import { Icon } from "../ui/Icon"
import { SectionHeader } from "../ui/SectionHeader"
import { StatCompare } from "../ui/StatCompare"
import { TypeList } from "../ui/TypeBadge"
import { Callout } from "../ui/Prose"
import { MoveNoteList, ReplacesHint } from "./LearnsetExplorer"

/**
 * The entry section that marks a species as having alternate forms, without
 * documenting the form-change mechanic itself.
 *
 * It is explicitly *not* source text, so it is kept out of the "Raw text for
 * this entry" dump (which is presented as the entry's verbatim source). Its raw
 * wording is never rendered: the card states that forms are changed as in the
 * base game, and points at where the Pokémon is obtained instead.
 */
export const FORM_CHANGE_NOTE_SECTION = 'Form Change (pipeline note)'

/** `Levitate → Motor Drive`, struck-through old value included. */
function Versus({ old, current }: { old: string[]; current: string[] }) {
  const oldText = old.join(' / ')
  const newText = current.join(' / ')
  if (oldText === newText) return <span className="text-sm text-ink">{newText}</span>
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-faint line-through">{oldText}</span>
      <Icon name="arrowRight" size={14} className="text-ink-faint" />
      <span className="font-medium text-ink">{newText}</span>
    </span>
  )
}

function FormVariantCard({ variant }: { variant: FormVariant }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="layers" size={15} className="text-ink-faint" />
          {variant.form}
        </h3>
        {variant.stats ? <Delta value={variant.stats.new.bst - variant.stats.old.bst} suffix=" BST" /> : null}
      </div>
      {/* A form without `types` is rendered without type badges: the documents
          do not state its typing, so none is guessed. */}
      {variant.types && variant.types.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Types</p>
          <TypeList types={variant.types} size="sm" />
        </div>
      ) : null}
      {variant.ability ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Abilities</p>
          <Versus old={variant.ability.old} current={variant.ability.new} />
        </div>
      ) : null}
      {variant.stats ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Base stats</p>
          <StatCompare old={variant.stats.old} new={variant.stats.new} mode="compare" />
        </div>
      ) : null}
      {variant.moves && variant.moves.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-faint uppercase">Moves</p>
          <MoveNoteList notes={variant.moves} />
        </div>
      ) : null}
      {variant.levelUp && variant.levelUp.length > 0 ? (
        <details className="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-ink">
            Level-up learnset ({variant.levelUp.length})
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {variant.levelUp.map((entry, index) => (
              <li key={`${entry.level}-${entry.move}-${index}`} className="flex items-baseline gap-2 text-xs">
                <span className="nums w-8 shrink-0 text-right font-mono text-ink-faint">{entry.level}</span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-ink">{entry.move}</span>
                  <ReplacesHint replaces={entry.replaces} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  )
}

/**
 * "Alternate forms" — the variants declared in the entry, with their own
 * typing, abilities, stats and learnsets, plus where the species is obtained.
 */
export function AlternateForms({ entry }: { entry: PokemonChange }) {
  const events = useSpeciesEvents(entry.name)
  const formChangeUndocumented = entry.sections.some((section) => section.title === FORM_CHANGE_NOTE_SECTION)
  const eventsRoute = `/events?q=${encodeURIComponent(entry.name)}`

  return (
    <section aria-labelledby="form-variants" className="space-y-3">
      <SectionHeader
        id="form-variants"
        title="Alternate forms"
        icon="layers"
        subtitle="Variants declared in the same source entry (Rotom, Shaymin, Deoxys, Wormadam…)."
        action={<Badge tone="outline">{plural(entry.forms.length, 'form')}</Badge>}
      />

      {formChangeUndocumented ? (
        <Callout tone="info">
          <p>Forms are changed the same way as in the base game.</p>
          {events.length > 0 ? (
            <p className="mt-2">
              Where it is obtained:{' '}
              {events.slice(0, 3).map((hit, index) => (
                <span key={`${hit.section}-${hit.title}-${index}`}>
                  {index > 0 ? ' · ' : ''}
                  <span className="font-medium text-ink">{hit.location ?? hit.section}</span>
                  {hit.location ? ` (${hit.title})` : ''}
                </span>
              ))}{' '}
              —{' '}
              <Link to={eventsRoute} className="font-medium text-accent hover:underline">
                Special events
              </Link>
              .
            </p>
          ) : (
            <p className="mt-2">
              <Link to="/events" className="font-medium text-accent hover:underline">
                Special events
              </Link>{' '}
              records where gift and static Pokémon are obtained.
            </p>
          )}
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {entry.forms.map((variant, index) => (
          <FormVariantCard key={`${variant.form}-${index}`} variant={variant} />
        ))}
      </div>
    </section>
  )
}
