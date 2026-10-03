import { useMemo, useState } from 'react'
import { loadMisc, useData } from "../../lib/data"
import { useSpeciesDex } from "../../lib/useSpeciesDex"
import { matches, plural } from "../../lib/format"
import { Badge, Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { BulletList, Callout } from "../../components/ui/Prose"
import { SearchField, Toolbar } from "../../components/ui/Controls"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonText } from "../../components/ui/Skeleton"
import { Sprite } from "../../components/ui/Sprite"

/** Parses "31 HP / 31 Atk / …" into labelled chips. */
function parseIvs(ivs: string): { label: string; value: string }[] {
  return ivs
    .split('/')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = /^(\d+)\s+(.+)$/.exec(chunk)
      if (!match) return { label: chunk, value: '' }
      return { label: match[2], value: match[1] }
    })
}

export function TradesView() {
  const { data: misc, loading } = useData(loadMisc)
  const [query, setQuery] = useState('')
  const dexOf = useSpeciesDex()

  const trades = useMemo(() => {
    const list = misc?.trades ?? []
    if (!query.trim()) return list
    return list.filter((trade) =>
      matches(
        `${trade.city} ${trade.request} ${trade.givenName ?? ''} ${trade.species ?? ''} ${trade.item ?? ''} ${trade.nature ?? ''}`,
        query,
      ),
    )
  }, [misc, query])

  return (
    <div className="space-y-6">
      <PageHeader
        title="In-game trades"
        subtitle="Every scripted trade asks for a different Pokémon now. Each partner arrives with an item, fixed IVs and a set nature: perfect for completing a set."
        meta={<Badge tone="accent">{plural(misc?.trades.length ?? 0, 'trade')}</Badge>}
      />

      {(misc?.tradeNotes.length ?? 0) > 0 ? (
        <Callout tone="info" title="Good to know">
          <BulletList lines={misc?.tradeNotes ?? []} icon={null} dense />
        </Callout>
      ) : null}

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for a trade"
          placeholder="City, Pokémon, item…"
          className="sm:max-w-md sm:flex-1"
        />
        <span className="nums shrink-0 text-xs text-ink-muted">
          {trades.length} / {misc?.trades.length ?? 0}
        </span>
      </Toolbar>

      {loading ? (
        <SkeletonText lines={10} />
      ) : trades.length === 0 ? (
        <EmptyState
          icon="swap"
          title="No trade matches"
          description="City and Pokémon names are in English, as in the game."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {trades.map((trade) => {
            const ivs = trade.ivs ? parseIvs(trade.ivs) : []
            return (
              <li key={`${trade.city}-${trade.givenName ?? trade.species ?? ''}`}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3.5">
                    <Sprite
                      dex={trade.species ? dexOf(trade.species, /\(S\)/.test(trade.species)) : undefined}
                      name={trade.species ?? trade.givenName ?? 'Trade'}
                      size={52}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-accent uppercase">
                        <Icon name="mapPin" size={12} />
                        {trade.city}
                      </p>
                      <h2 className="mt-0.5 text-sm font-bold tracking-tight text-ink">
                        {trade.givenName ?? trade.species ?? 'Trade'}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{trade.request}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {trade.item ? (
                      <Badge tone="neutral">
                        <Icon name="tag" size={11} />
                        {trade.item}
                      </Badge>
                    ) : null}
                    {trade.nature ? (
                      <Badge tone="info">
                        <Icon name="sparkles" size={11} />
                        {trade.nature}
                      </Badge>
                    ) : null}
                  </div>

                  {ivs.length > 0 ? (
                    <div className="border-t border-line pt-3">
                      <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                        Guaranteed IVs
                      </p>
                      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {ivs.map((iv) => (
                          <li
                            key={iv.label}
                            className="rounded-lg border border-line bg-surface-2 px-1.5 py-1 text-center"
                          >
                            <span className="block font-mono text-[10px] text-ink-faint uppercase">{iv.label}</span>
                            <span className="nums block font-mono text-sm font-bold text-ink">{iv.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {trade.lines.length > 0 ? (
                    <div className="mt-auto border-t border-line pt-3">
                      <BulletList lines={trade.lines} dense />
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
