import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MoveFieldChange, MoveFieldException, MoveModification, NewMove } from "../types/data"
import { cls, matches, plural } from "../lib/format"
import { loadMoves, useData } from "../lib/data"
import { Badge, Card } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SearchField, Toolbar } from "../components/ui/Controls"
import { Tabs } from "../components/ui/Tabs"
import { SkeletonGrid, SkeletonRows } from "../components/ui/Skeleton"
import { TypeBadge } from "../components/ui/TypeBadge"
import { BulletList, Callout, NoteSections } from "../components/ui/Prose"

type MovesTab = 'new' | 'replacements' | 'modifications' | 'notes'

const TAB_ORDER: MovesTab[] = ['new', 'replacements', 'modifications', 'notes']

const TAB_LABELS: Record<MovesTab, string> = {
  new: 'New moves',
  replacements: 'Replacements',
  modifications: 'Modifications',
  notes: 'Notes',
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Everything searchable about a modification, including its exceptions. */
function modificationHaystack(modification: MoveModification): string {
  return [
    modification.label,
    modification.moves.join(' '),
    modification.changes.map((change) => `${change.label} ${change.from} ${change.to}`).join(' '),
    modification.exceptions
      .map((exception) => `${exception.moves.join(' ')} ${exception.label} ${exception.from} ${exception.to}`)
      .join(' '),
  ].join(' ')
}

/** `Fire Blast/Thunder/Blizzard` and `Fire Blast / Thunder / Blizzard` are the same list. */
function normalizeLabel(value: string): string {
  return value.replace(/\s*\/\s*/g, ' / ').trim().toLowerCase()
}

function NewMoveCard({ move }: { move: NewMove }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Icon name="sparkles" size={15} className="text-accent" />
          {move.name}
        </h3>
        {move.type ? <TypeBadge type={move.type} size="sm" /> : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-center">
          <p className="text-[10px] tracking-wide text-ink-faint uppercase">Power</p>
          <p className="nums font-mono text-lg font-bold text-ink">{move.power ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-center">
          <p className="text-[10px] tracking-wide text-ink-faint uppercase">PP</p>
          <p className="nums font-mono text-lg font-bold text-ink">{move.pp ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-center">
          <p className="text-[10px] tracking-wide text-ink-faint uppercase">Accuracy</p>
          <p className="nums font-mono text-lg font-bold text-ink">{move.accuracy ?? '—'}</p>
        </div>
      </div>

      {move.class ? (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <Icon name="zap" size={13} className="text-ink-faint" />
          {move.class}
        </p>
      ) : null}
      {move.effect ? (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink">
          <span className="font-semibold text-ink-faint uppercase">Effect · </span>
          {move.effect}
        </p>
      ) : null}
      {move.description ? <p className="text-xs leading-relaxed text-ink-muted italic">{move.description}</p> : null}
    </Card>
  )
}

/**
 * `Label   old → new` rows shared by every modification card.
 *
 * Some records state a fact rather than a change to a value (the source writes
 * `Note` with no "old" part): those render as the value alone, never as an
 * empty strikethrough followed by an arrow.
 */
function ChangeRows({ changes }: { changes: MoveFieldChange[] }) {
  return (
    <div className="space-y-2">
      {changes.map((change, index) => (
        <div
          key={`${change.label}-${index}`}
          className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0"
        >
          <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{change.label}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {change.from ? (
              <>
                <span className="text-ink-faint line-through">{change.from}</span>
                <Icon name="arrowRight" size={13} className="text-ink-faint" />
              </>
            ) : null}
            <span className="font-medium text-ink">{change.to}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * An exception applies to a *subset* of a group's moves. It is rendered inside
 * its own bordered block, with the moves it concerns spelled out, so it can
 * never be read as applying to the whole group.
 */
function ExceptionBlock({ exception }: { exception: MoveFieldException }) {
  return (
    <div className="rounded-lg border border-warn/35 bg-warn/10 px-3 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
        <Icon name="alert" size={12} className="shrink-0 text-warn" />
        <span className="font-semibold">Only for</span>
        {exception.moves.map((move) => (
          <span
            key={move}
            className="rounded border border-line bg-surface px-1.5 py-px font-medium text-ink"
          >
            {move}
          </span>
        ))}
      </p>
      <div className="mt-2 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{exception.label}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {exception.from ? (
            <>
              <span className="text-ink-faint line-through">{exception.from}</span>
              <Icon name="arrowRight" size={13} className="text-ink-faint" />
            </>
          ) : null}
          <span className="font-medium text-ink">{exception.to}</span>
        </span>
      </div>
    </div>
  )
}

/** A `MoveModification` covering a single move. */
function ModificationCard({ modification, query }: { modification: MoveModification; query: string }) {
  const highlight = query.trim().length > 0
  /* `moves[0]` is the move itself; `label` is the display name for the block. */
  const title = modification.label || modification.moves[0] || '—'
  return (
    <Card className="space-y-3">
      <h3
        className={cls(
          'flex items-center gap-2 text-sm font-bold tracking-tight text-ink',
          highlight && 'text-accent',
        )}
      >
        <Icon name="zap" size={15} className="text-ink-faint" />
        {title}
      </h3>
      <ChangeRows changes={modification.changes} />
      {modification.exceptions.map((exception, index) => (
        <ExceptionBlock key={`${exception.label}-${index}`} exception={exception} />
      ))}
    </Card>
  )
}

/** A grouped ("batch") modification covering several similar moves. */
function GroupModificationCard({ modification, query }: { modification: MoveModification; query: string }) {
  const active = query.trim()
  const joined = modification.moves.join(' / ')
  const showLabel = modification.label.length > 0 && normalizeLabel(modification.label) !== normalizeLabel(joined)

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Icon name="layers" size={15} className="text-ink-faint" />
          {showLabel ? modification.label : 'Grouped modification'}
        </h3>
        <Badge tone="outline">{plural(modification.moves.length, 'move')}</Badge>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {modification.moves.map((move) => (
          <li
            key={move}
            className={cls(
              'rounded-pill border px-2 py-0.5 text-[11px] font-medium',
              active && matches(move, active)
                ? 'border-accent/50 bg-accent/12 text-accent'
                : 'border-line bg-surface-2 text-ink-muted',
            )}
          >
            {move}
          </li>
        ))}
      </ul>

      <ChangeRows changes={modification.changes} />

      {modification.exceptions.length > 0 ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
            Exceptions — only some of the moves above
          </p>
          {modification.exceptions.map((exception, index) => (
            <ExceptionBlock key={`${exception.label}-${index}`} exception={exception} />
          ))}
        </div>
      ) : null}
    </Card>
  )
}

export function MovesView() {
  const { data: doc, loading } = useData(loadMoves)
  const [params, setParams] = useSearchParams()
  const queryFromUrl = params.get('q') ?? ''
  const [query, setQuery] = useState(queryFromUrl)

  const tab = (params.get('tab') as MovesTab) ?? 'new'
  const safeTab: MovesTab = (TAB_ORDER as string[]).includes(tab) ? tab : 'new'

  function setTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    setParams(next, { replace: true })
  }

  /*
   * A search result links to `#/moves?q=<move>`: the query must reach the input,
   * otherwise clicking a modified move lands on an unfiltered page.
   */
  useEffect(() => {
    setQuery(queryFromUrl)
  }, [queryFromUrl])

  // Debounced write-back so the address bar stays shareable.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      if (next.toString() !== params.toString()) setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(id)
  }, [query, params, setParams])

  const needle = query.trim()

  const replacements = useMemo(() => {
    const list = doc?.replacements ?? []
    if (!needle) return list
    return list.filter((entry) => matches(`${entry.oldMove} ${entry.newMove}`, needle))
  }, [doc, needle])

  const newMoves = useMemo(() => {
    const list = doc?.newMoves ?? []
    if (!needle) return list
    return list.filter((move) =>
      matches(`${move.name} ${move.type ?? ''} ${move.effect ?? ''} ${move.description ?? ''}`, needle),
    )
  }, [doc, needle])

  const modifications = useMemo(() => {
    const list = doc?.modifications ?? []
    if (!needle) return list
    return list.filter((modification) => matches(modificationHaystack(modification), needle))
  }, [doc, needle])

  const groupModifications = useMemo(() => {
    const list = doc?.groupModifications ?? []
    if (!needle) return list
    return list.filter((modification) => matches(modificationHaystack(modification), needle))
  }, [doc, needle])

  const groupNotes = doc?.groupNotes ?? []
  const noteCount = doc?.noteSections.length ?? 0

  const totals = useMemo(
    () => ({
      new: doc?.newMoves.length ?? 0,
      replacements: doc?.replacements.length ?? 0,
      modifications: (doc?.modifications.length ?? 0) + (doc?.groupModifications.length ?? 0),
      notes: noteCount,
    }),
    [doc, noteCount],
  )

  /** With a query active the badges count what is actually shown. */
  const counts = {
    new: newMoves.length,
    replacements: replacements.length,
    modifications: modifications.length + groupModifications.length,
    notes: noteCount,
  }
  const badgeCounts = needle ? counts : totals
  const matchKey = TAB_ORDER.map((entry) => counts[entry]).join(',')

  /*
   * Landing from a search result: open the section that actually contains the
   * searched move instead of showing an empty tab. A manual tab click is still
   * respected afterwards because this only runs once per distinct `?q=`.
   */
  const appliedQuery = useRef('')
  /* `counts` is derived from the lists above; `matchKey` is its stable identity. */
  useEffect(() => {
    if (!queryFromUrl || loading) return
    if (appliedQuery.current === queryFromUrl) return
    appliedQuery.current = queryFromUrl
    if (counts[safeTab] > 0) return
    const first = TAB_ORDER.find((entry) => counts[entry] > 0)
    if (first) setTab(first)
  }, [queryFromUrl, loading, matchKey, safeTab])

  /** Where a query matched, offered from an empty tab. */
  const otherTab = TAB_ORDER.filter((entry) => entry !== safeTab).find((entry) => counts[entry] > 0)

  const newMoveNames = useMemo(() => new Set((doc?.newMoves ?? []).map((move) => move.name)), [doc])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moves"
        subtitle="Power, accuracy and PP aligned with Ultra Sun / Ultra Moon, 29 replaced moves, 10 brand-new moves and every documented numeric tweak."
        meta={
          <>
            <Badge tone="accent">{plural(doc?.newMoves.length ?? 0, 'new move')}</Badge>
            <Badge tone="outline">{plural(doc?.replacements.length ?? 0, 'replacement')}</Badge>
            <Badge tone="outline">{plural(doc?.modifications.length ?? 0, 'modification')}</Badge>
            {groupNotes.length > 0 || (doc?.groupModifications.length ?? 0) > 0 ? (
              <Badge tone="outline">{plural(doc?.groupModifications.length ?? 0, 'grouped modification')}</Badge>
            ) : null}
          </>
        }
      />

      {(doc?.generalNotes.length ?? 0) > 0 ? (
        <Callout tone="info" title="General changes">
          <BulletList lines={doc?.generalNotes ?? []} icon={null} dense />
        </Callout>
      ) : null}

      <Tabs
        label="Move sections"
        value={safeTab}
        onChange={setTab}
        tabs={TAB_ORDER.map((entry) => ({ id: entry, label: TAB_LABELS[entry], count: badgeCounts[entry] }))}
      />

      {safeTab !== 'notes' ? (
        <Toolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            label="Search for a move"
            placeholder="Move name…"
            className="sm:max-w-md sm:flex-1"
          />
          <span className="nums shrink-0 text-xs text-ink-muted">
            {plural(counts[safeTab], 'result')}
          </span>
        </Toolbar>
      ) : null}

      {loading ? (
        safeTab === 'replacements' || safeTab === 'modifications' ? (
          <SkeletonRows rows={8} />
        ) : (
          <SkeletonGrid count={6} />
        )
      ) : null}

      {!loading && safeTab === 'new' ? (
        newMoves.length === 0 ? (
          <EmptyState
            icon="zap"
            title="No new moves"
            description="No result for this search."
            action={otherTab ? <JumpToTab tab={otherTab} count={counts[otherTab]} onJump={setTab} /> : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {newMoves.map((move) => (
              <NewMoveCard key={move.name} move={move} />
            ))}
          </div>
        )
      ) : null}

      {!loading && safeTab === 'replacements' ? (
        replacements.length === 0 ? (
          <EmptyState
            icon="swap"
            title="No replacements"
            description="No result for this search."
            action={otherTab ? <JumpToTab tab={otherTab} count={counts[otherTab]} onJump={setTab} /> : undefined}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase sm:grid">
              <span>Original move (unavailable)</span>
              <span aria-hidden="true" />
              <span>Replacement move</span>
            </div>
            <ul>
              {replacements.map((entry) => (
                <li
                  key={`${entry.oldMove}-${entry.newMove}`}
                  className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
                >
                  <span className="text-sm text-ink-faint line-through">{entry.oldMove}</span>
                  <Icon name="arrowRight" size={15} className="hidden text-ink-faint sm:block" />
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {entry.newMove}
                    {entry.isNew || newMoveNames.has(entry.newMove) ? (
                      <Badge tone="accent">New</Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {!loading && safeTab === 'modifications' ? (
        modifications.length === 0 && groupModifications.length === 0 ? (
          <EmptyState
            icon="list"
            title="No modifications"
            description="No result for this search."
            action={otherTab ? <JumpToTab tab={otherTab} count={counts[otherTab]} onJump={setTab} /> : undefined}
          />
        ) : (
          <div className="space-y-6">
            {modifications.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {modifications.map((modification) => (
                  <ModificationCard
                    key={`${modification.label}-${modification.moves.join('-')}`}
                    modification={modification}
                    query={query}
                  />
                ))}
              </div>
            ) : null}

            {/*
              The "Move Group Modifications" section: grouped changes used to be
              rendered as a flat modification record ("Batch changes made to
              multiple similar moves.") followed by unrelated single changes.
            */}
            {groupModifications.length > 0 ? (
              <section aria-labelledby="moves-grouped" className="space-y-4 border-t border-line pt-5">
                <SectionHeader
                  id="moves-grouped"
                  eyebrow="Grouped modifications"
                  title="Moves changed in batches"
                  icon="layers"
                  action={<Badge tone="outline">{plural(groupModifications.length, 'group')}</Badge>}
                />

                {groupNotes.length > 0 ? (
                  <div className="space-y-1.5">
                    {groupNotes.map((note) => (
                      <p key={note} className="max-w-3xl text-sm leading-relaxed text-ink-muted">
                        {note}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 border-t border-line pt-4 xl:grid-cols-2">
                  {groupModifications.map((modification) => (
                    <GroupModificationCard
                      key={`${modification.label}-${modification.moves.join('-')}`}
                      modification={modification}
                      query={query}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {!loading && safeTab === 'notes' ? (
        noteCount === 0 ? (
          <EmptyState icon="clipboard" title="No additional notes" />
        ) : (
          <Card className="space-y-6">
            {(doc?.noteSections ?? []).map((section) => (
              <div key={section.title}>
                <SectionHeader title={section.title} level="h3" className="mb-2" />
                <BulletList lines={section.lines} dense />
              </div>
            ))}
          </Card>
        )
      ) : null}

      <section aria-labelledby="moves-notes" className="space-y-4">
        <SectionHeader
          id="moves-notes"
          eyebrow="Reminder"
          title="Every numeric value"
          icon="info"
          subtitle="The hack aligns power, accuracy, PP, effect chance and priority with Ultra Sun / Ultra Moon (see the “Curse / Charm / Moonlight / Sweet Kiss” note below)."
        />
        {(doc?.noteSections.length ?? 0) > 0 ? (
          <Card>
            <NoteSections sections={doc?.noteSections ?? []} />
          </Card>
        ) : null}
      </section>
    </div>
  )
}

/** Empty-state shortcut: "the query matched somewhere else". */
function JumpToTab({ tab, count, onJump }: { tab: MovesTab; count: number; onJump: (tab: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onJump(tab)}
      className="rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
    >
      See in “{TAB_LABELS[tab]}” ({count})
    </button>
  )
}
