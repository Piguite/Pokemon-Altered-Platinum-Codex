import { useMemo, useState } from 'react'
import { loadMisc, loadTrainers, useData } from "../../lib/data"
import { matches, plural } from "../../lib/format"
import { Badge, Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { Callout } from "../../components/ui/Prose"
import { SearchField, Toolbar } from "../../components/ui/Controls"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonRows } from "../../components/ui/Skeleton"

interface Cap {
  raw: string
  name: string
  level: number | null
}

function parseCap(raw: string): Cap {
  const match = /^(.*?),\s*Lv\.\s*(\d+)\s*$/.exec(raw)
  if (match) return { raw, name: match[1].trim(), level: Number(match[2]) }
  return { raw, name: raw, level: null }
}

export function LevelCapsView() {
  const { data: misc, loading: miscLoading } = useData(loadMisc)
  const { data: trainers, loading: trainersLoading } = useData(loadTrainers)
  const [query, setQuery] = useState('')

  const raw = useMemo(() => {
    const fromMisc = misc?.levelCaps ?? []
    if (fromMisc.length > 0) return fromMisc
    return trainers?.levelCaps ?? []
  }, [misc, trainers])

  const caps = useMemo(() => raw.map(parseCap), [raw])
  const filtered = useMemo(
    () => (query.trim() ? caps.filter((cap) => matches(`${cap.name} ${cap.level ?? ''}`, query)) : caps),
    [caps, query],
  )

  const maxLevel = caps.reduce((max, cap) => (cap.level && cap.level > max ? cap.level : max), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Level caps"
        subtitle="The level of the important trainers, stage by stage. Staying within them avoids over-levelling, and the hack officially treats Rare Candies as fair game."
        meta={
          <>
            <Badge tone="accent">{plural(caps.length, 'stage')}</Badge>
            {maxLevel > 0 ? <Badge tone="outline">Up to level {maxLevel}</Badge> : null}
          </>
        }
      />

      <Callout tone="good" title="The author's tip">
        If you stay within these caps, using Rare Candies to avoid grinding is explicitly considered
        legitimate.
      </Callout>

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for a stage"
          placeholder="Trainer name…"
          className="sm:max-w-md sm:flex-1"
        />
        <span className="nums shrink-0 text-xs text-ink-muted">
          {filtered.length} / {caps.length}
        </span>
      </Toolbar>

      {miscLoading && trainersLoading ? (
        <SkeletonRows rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="trending"
          title="No level cap matches"
          description="Trainer names are in English, as in the game."
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ol className="relative">
            {filtered.map((cap, index) => (
              <li
                key={`${cap.raw}-${index}`}
                className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="nums grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-xs font-bold text-ink-faint">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{cap.name}</span>
                  <span className="block truncate text-[11px] text-ink-faint">Level target</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-pill bg-surface-3 sm:block" aria-hidden="true">
                    <span
                      className="block h-full rounded-pill bg-accent"
                      style={{ width: `${maxLevel ? (Number(cap.level ?? 0) / maxLevel) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="nums font-mono text-lg font-extrabold text-ink">{cap.level ?? '—'}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-ink-faint">
        <Icon name="info" size={13} />
        These caps are duplicated from the LevelCaps.txt and TrainerPokemon.txt documents.
      </p>
    </div>
  )
}
