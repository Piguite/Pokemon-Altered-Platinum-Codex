import { Link } from 'react-router-dom'
import type { PokemonChange, SinnohanForm } from "../../types/data"
import { cls, dexLabel, signed, statTotal } from "../../lib/format"
import { CHANGE_KIND_SHORT, CHANGE_KIND_TONES } from "../../lib/labels"
import { resolveTypeChange, sinnohanTypeChange } from "../../lib/typechange"
import { Badge } from "../ui/Card"
import { Icon } from "../ui/Icon"
import { Sprite } from "../ui/Sprite"
import { TypeChangeTag, TypeList, TypeTransition } from "../ui/TypeBadge"

export function pokemonRoute(entry: PokemonChange): string {
  return entry.isSinnohan ? `/sinnohan/${entry.slug}` : `/pokemon/${entry.slug}`
}

/**
 * The full-width type-change line shared by both list cards.
 *
 * The tag and the indicator belong together: the tag says *what* the line is,
 * the indicator says *what changed*. It gets its own row rather than sitting in
 * the sprite column, because `Fire / Flying → Fire · +Dragon` needs the card's
 * whole width to stay on one line.
 */
function CardTypeChange({ oldTypes, newTypes }: { oldTypes: string[]; newTypes: string[] }) {
  return (
    <div className="mt-2.5">
      <TypeTransition
        oldTypes={oldTypes}
        newTypes={newTypes}
        size="xs"
        sideLabels
        leading={<TypeChangeTag />}
      />
    </div>
  )
}

/** Compact row used by the Pokémon list. */
export function PokemonCard({
  entry,
  sinnohanForm,
}: {
  entry: PokemonChange
  /**
   * The matching Sinnohan form, when the list has `sinnohan.json` loaded.
   * Sinnohan entries in `pokemon.json` carry no `type`: their type change is
   * only recorded in SinnohanForms.txt, so the form supplies it.
   */
  sinnohanForm?: SinnohanForm
}) {
  const bstGain = entry.stats ? entry.stats.new.bst - entry.stats.old.bst : 0
  /* rev 2: every entry has an effective spread, documented or from the baseline. */
  const bst = entry.baseStats?.bst ?? entry.stats?.new.bst

  /* rev 3: a documented change wins; a Sinnohan entry falls back to its form. */
  const change = resolveTypeChange(entry, sinnohanForm)
  /*
   * The `type` change kind is what the "Type change" tag already says, so the
   * generic badge is dropped when the change itself is on the card.
   */
  const kindList = change ? entry.changeKinds.filter((kind) => kind !== 'type') : entry.changeKinds
  const shownKinds = kindList.slice(0, 4)
  const hiddenKinds = kindList.length - shownKinds.length
  /*
   * With no documented change the vanilla Gen-IV typing is shown as plain
   * chips — never as a change, and never for a Sinnohan entry (its `baseTypes`
   * are the replaced species' typing, which alone would be misleading).
   */
  const plainTypes = change || entry.isSinnohan ? [] : entry.baseTypes ?? []

  return (
    <Link
      to={pokemonRoute(entry)}
      className="group flex flex-col rounded-card border border-line bg-surface p-3.5 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-start gap-3">
        <Sprite dex={entry.dex} name={entry.name} sinnohan={entry.isSinnohan} size={52} />
        <div className="min-w-0 flex-1">
          <p className="nums font-mono text-[11px] text-ink-faint">{dexLabel(entry.dex)}</p>
          <h3 className="truncate text-sm font-bold tracking-tight text-ink">{entry.name}</h3>
          {plainTypes.length > 0 ? (
            <div
              className="mt-1.5"
              title="Vanilla Generation-IV typing — this entry documents no type change"
            >
              <TypeList types={plainTypes} size="xs" />
            </div>
          ) : null}
        </div>
        {bstGain !== 0 ? (
          <span
            className={cls(
              'nums shrink-0 rounded-pill px-2 py-0.5 font-mono text-[11px] font-bold',
              bstGain > 0 ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad',
            )}
            title={`Base stat total: ${signed(bstGain)}`}
          >
            {signed(bstGain)} BST
          </span>
        ) : null}
      </div>

      {change ? <CardTypeChange oldTypes={change.old} newTypes={change.new} /> : null}

      {shownKinds.length > 0 || hiddenKinds > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {shownKinds.map((kind) => (
            <Badge key={kind} tone={CHANGE_KIND_TONES[kind]}>
              {CHANGE_KIND_SHORT[kind]}
            </Badge>
          ))}
          {hiddenKinds > 0 ? <Badge tone="outline">+{hiddenKinds}</Badge> : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px] text-ink-faint">
        <span className="nums font-mono">
          BST {bst ?? '—'}
          {entry.learnset.levelUp.length > 0 ? ` · ${entry.learnset.levelUp.length} moves` : ''}
        </span>
        <span className="inline-flex items-center gap-1 text-ink-muted transition-transform group-hover:translate-x-0.5">
          Details <Icon name="chevronRight" size={13} />
        </span>
      </div>
    </Link>
  )
}

/** Card used by the Sinnohan gallery. */
export function SinnohanCard({ form }: { form: SinnohanForm }) {
  const total = form.stats.bst || statTotal(form.stats)
  /* All 65 forms replace the original species' typing: the change is the story. */
  const change = sinnohanTypeChange(form)

  return (
    <Link
      to={`/sinnohan/${form.slug}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-3.5 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-center gap-3.5">
        <Sprite dex={form.dex} name={form.name} sinnohan size={54} />
        <div className="min-w-0 flex-1">
          <p className="nums font-mono text-[11px] text-ink-faint">{dexLabel(form.dex)}</p>
          <h3 className="truncate text-sm font-bold tracking-tight text-ink">{form.name}</h3>
          <p className="mt-1.5 truncate text-[11px] text-ink-faint">{form.abilities.join(' / ')}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="nums font-mono text-lg font-extrabold text-ink">{total}</p>
          <p className="text-[10px] tracking-wide text-ink-faint uppercase">BST</p>
        </div>
      </div>

      {/* The form's types are the headline: it always replaces the original
          species' typing, so the tag + old → new indicator lead the card. */}
      <div className="mt-2.5">
        {change ? (
          <TypeTransition
            oldTypes={change.old}
            newTypes={change.new}
            size="xs"
            sideLabels
            leading={<TypeChangeTag />}
          />
        ) : (
          <TypeList types={form.types} size="xs" />
        )}
      </div>
    </Link>
  )
}
