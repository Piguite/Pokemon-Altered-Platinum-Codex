import { useMemo, useState } from 'react'
import type { Learnset, MoveNote, TMLearn, TutorLearn } from "../../types/data"
import { cls, plural } from "../../lib/format"
import { Badge } from "../ui/Card"
import { DataTable } from "../ui/DataTable"
import type { Column, SortState } from "../ui/DataTable"
import { EmptyState } from "../ui/EmptyState"
import { SelectField } from "../ui/Controls"
import { Tabs } from "../ui/Tabs"
import { Icon } from "../ui/Icon"

export type LearnsetTab = 'level' | 'tm' | 'tutor'
export type LevelSort = 'levelAsc' | 'levelDesc' | 'nameAsc' | 'nameDesc'

const LEVEL_SORT_OPTIONS: { value: LevelSort; label: string }[] = [
  { value: 'levelAsc', label: 'Level (ascending)' },
  { value: 'levelDesc', label: 'Level (descending)' },
  { value: 'nameAsc', label: 'Name (A → Z)' },
  { value: 'nameDesc', label: 'Name (Z → A)' },
]

/** `(!!)` and `(PLA)` markers rendered as distinct, labelled chips. */
export function MoveMarkers({ isNew, source, className }: { isNew: boolean; source?: 'PLA'; className?: string }) {
  if (!isNew && !source) return null
  return (
    <span className={cls('inline-flex items-center gap-1', className)}>
      {isNew ? (
        <span
          title="(!!) Move newly available to this Pokémon"
          className="inline-flex items-center gap-1 rounded-pill border border-accent/40 bg-accent/12 px-1.5 py-px text-[10px] font-semibold text-accent"
        >
          <Icon name="sparkles" size={10} />
          New
        </span>
      ) : null}
      {source === 'PLA' ? (
        <span
          title="(PLA) Move from Pokémon Legends: Arceus"
          className="inline-flex items-center gap-1 rounded-pill border border-info/40 bg-info/12 px-1.5 py-px font-mono text-[10px] font-semibold text-info"
        >
          PLA
        </span>
      ) : null}
    </span>
  )
}

/**
 * `LEVEL - OldMove >> NewMove` in the source means the learnset slot was
 * re-pointed: the Pokémon now learns `NewMove` where it used to learn
 * `OldMove`. Rendered as a quiet suffix on the same row — never as a second
 * move — so the primary name stays unambiguous.
 */
export function ReplacesHint({ replaces, className }: { replaces?: string; className?: string }) {
  if (!replaces) return null
  return (
    <span
      title={`This learnset slot taught ${replaces} before the hack: ${replaces} is no longer learned at this level.`}
      className={cls('text-[11px] leading-4 text-ink-faint', className)}
    >
      replaces <span className="line-through decoration-ink-faint/70">{replaces}</span>
    </span>
  )
}

export function MoveNoteList({ notes, className }: { notes: MoveNote[]; className?: string }) {
  if (notes.length === 0) return null
  return (
    <ul className={cls('space-y-1.5', className)}>
      {notes.map((note, index) => (
        <li key={index} className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Icon name="check" size={14} className="shrink-0 text-ink-faint" />
          <span className="min-w-0 flex-1">{note.text}</span>
          <MoveMarkers isNew={note.isNew} source={note.source} />
        </li>
      ))}
    </ul>
  )
}

export interface LearnsetExplorerProps {
  learnset: Learnset
  /** Controlled tab — pass it when the tab is synced with the URL. */
  tab: LearnsetTab
  onTabChange: (tab: LearnsetTab) => void
  levelSort?: LevelSort
  onLevelSortChange?: (sort: LevelSort) => void
  className?: string
  /** Hide the level-sort control (used for the compact form-variant panels). */
  compact?: boolean
}

/**
 * Level-up / TM / Tutor explorer.
 * Level-up moves can be sorted by level or by name; `(!!)` and `(PLA)` markers
 * are surfaced as chips in every mode.
 */
export function LearnsetExplorer({
  learnset,
  tab,
  onTabChange,
  levelSort = 'levelAsc',
  onLevelSortChange,
  className,
  compact = false,
}: LearnsetExplorerProps) {
  const [localSort, setLocalSort] = useState<LevelSort>('levelAsc')
  const sort = onLevelSortChange ? levelSort : localSort
  const setSort = onLevelSortChange ?? setLocalSort

  /** TM and tutor lists sort in place: clicking a column header toggles them. */
  const [tmSort, setTmSort] = useState<SortState>({ key: 'num', dir: 'asc' })
  const [tutorSort, setTutorSort] = useState<SortState>({ key: 'move', dir: 'asc' })

  const levelRows = useMemo(() => {
    const rows = [...learnset.levelUp]
    switch (sort) {
      case 'levelAsc':
        return rows.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move, 'en'))
      case 'levelDesc':
        return rows.sort((a, b) => b.level - a.level || a.move.localeCompare(b.move, 'en'))
      case 'nameAsc':
        return rows.sort((a, b) => a.move.localeCompare(b.move, 'en') || a.level - b.level)
      case 'nameDesc':
        return rows.sort((a, b) => b.move.localeCompare(a.move, 'en') || a.level - b.level)
      default:
        return rows
    }
  }, [learnset.levelUp, sort])

  const tmRows = useMemo(
    () => [...learnset.tm].sort((a, b) => a.num.localeCompare(b.num, 'en', { numeric: true })),
    [learnset.tm],
  )

  const tutorRows = useMemo(
    () => [...learnset.tutor].sort((a, b) => a.move.localeCompare(b.move, 'en')),
    [learnset.tutor],
  )

  const newCount = learnset.levelUp.filter((entry) => entry.isNew).length
  const plaCount = learnset.levelUp.filter((entry) => entry.source === 'PLA').length
  const replacedCount = learnset.levelUp.filter((entry) => entry.replaces).length
  const newTmCount = learnset.tm.filter((entry) => entry.isNew).length
  const newTutorCount = learnset.tutor.filter((entry) => entry.isNew).length

  const levelColumns: Column<(typeof levelRows)[number]>[] = [
    {
      key: 'level',
      header: 'Lv.',
      align: 'right',
      primary: true,
      className: 'w-16',
      cell: (row) => <span className="nums font-mono text-xs font-semibold text-ink">{row.level}</span>,
    },
    {
      key: 'move',
      header: 'Move',
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{row.move}</span>
            <MoveMarkers isNew={row.isNew} source={row.source} />
          </span>
          <ReplacesHint replaces={row.replaces} />
        </span>
      ),
    },
  ]

  const tmColumns: Column<TMLearn>[] = [
    {
      key: 'num',
      header: 'No.',
      primary: true,
      sortable: true,
      className: 'w-24',
      sortValue: (row) => row.num,
      cell: (row) => <span className="nums font-mono text-xs font-semibold text-ink">{row.num}</span>,
    },
    {
      key: 'move',
      header: 'Move',
      sortable: true,
      sortValue: (row) => row.move,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{row.move}</span>
          <MoveMarkers isNew={row.isNew === true} />
        </span>
      ),
    },
  ]

  const tutorColumns: Column<TutorLearn>[] = [
    {
      key: 'move',
      header: 'Move',
      primary: true,
      sortable: true,
      sortValue: (row) => row.move,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{row.move}</span>
          <MoveMarkers isNew={row.isNew === true} />
        </span>
      ),
    },
  ]

  return (
    <div className={cls('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Learnset type"
          value={tab}
          onChange={(value) => onTabChange(value as LearnsetTab)}
          tabs={[
            { id: 'level', label: 'Level-up', count: learnset.levelUp.length },
            { id: 'tm', label: 'TM / HM', count: learnset.tm.length },
            { id: 'tutor', label: 'Move Tutor', count: learnset.tutor.length },
          ]}
        />
        {tab === 'level' && !compact && levelRows.length > 0 ? (
          <SelectField
            value={sort}
            onChange={(value) => setSort(value)}
            options={LEVEL_SORT_OPTIONS}
            label="Sort moves"
            className="w-52"
          />
        ) : null}
      </div>

      {/*
        The hack's documents only record *changes*, so the lists were completed
        from vanilla Platinum. Say so quietly, once, next to the lists — a
        baseline entry must never read as a documented change of the hack.
      */}
      {learnset.includesBaseline ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          <span>
            List completed from vanilla <span className="text-ink-muted">Pokémon Platinum</span>{' '}
            (PokeAPI): moves with no&nbsp;<span className="text-ink-muted">New</span>&nbsp;marker come from the
            base game, not from the hack's documentation.
          </span>
        </p>
      ) : null}

      {tab === 'level' ? (
        levelRows.length === 0 ? (
          <EmptyState inline icon="zap" title="No level-up moves" description="This entry documents no level-up learnset." />
        ) : (
          <>
            {newCount > 0 || plaCount > 0 || replacedCount > 0 ? (
              <div className="space-y-1.5">
                {newCount > 0 || plaCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {newCount > 0 ? (
                      <Badge tone="accent">
                        {plural(newCount, 'new move')} (!!)
                      </Badge>
                    ) : null}
                    {plaCount > 0 ? <Badge tone="info">{plural(plaCount, 'move')} (PLA)</Badge> : null}
                  </div>
                ) : null}
                {replacedCount > 0 ? (
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    “<span className="text-ink-muted">replaces&nbsp;X</span>” marks a learnset slot the hack
                    re-pointed: that slot taught X in the original game and now teaches only the move shown.
                  </p>
                ) : null}
              </div>
            ) : null}
            <DataTable rows={levelRows} columns={levelColumns} getKey={(row, index) => `${row.level}-${row.move}-${index}`} dense />
          </>
        )
      ) : null}

      {tab === 'tm' ? (
        tmRows.length === 0 ? (
          <EmptyState inline icon="tag" title="No TM/HM listed" description="This entry documents no TM compatibility." />
        ) : (
          <>
            {newTmCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{plural(newTmCount, 'new TM/HM compatibility', 'new TM/HM compatibilities')} (!!)</Badge>
              </div>
            ) : null}
            <DataTable
              rows={tmRows}
              columns={tmColumns}
              getKey={(row, index) => `${row.num}-${row.move}-${index}`}
              sort={tmSort}
              onSortChange={setTmSort}
              dense
            />
          </>
        )
      ) : null}

      {tab === 'tutor' ? (
        tutorRows.length === 0 ? (
          <EmptyState inline icon="book" title="No Move Tutor moves" description="This entry documents no Move Tutor compatibility." />
        ) : (
          <>
            {newTutorCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{plural(newTutorCount, 'new Move Tutor move')} (!!)</Badge>
              </div>
            ) : null}
            <DataTable
              rows={tutorRows}
              columns={tutorColumns}
              getKey={(row, index) => `${row.move}-${index}`}
              sort={tutorSort}
              onSortChange={setTutorSort}
              dense
            />
          </>
        )
      ) : null}
    </div>
  )
}

/** Sort state helper shared with tables that want URL-persisted sorting. */
export function useTableSort(initial: SortState): [SortState, (next: SortState) => void] {
  const [sort, setSort] = useState<SortState>(initial)
  return [sort, setSort]
}
