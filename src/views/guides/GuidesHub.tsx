import { Link } from 'react-router-dom'
import { GUIDE_LINKS } from "../../lib/routes"
import { loadChangelog, loadMisc, loadTrainers, useData } from "../../lib/data"
import { plural } from "../../lib/format"
import { Badge, Card, CardLink } from "../../components/ui/Card"
import { Icon } from "../../components/ui/Icon"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonRows } from "../../components/ui/Skeleton"
import { EmptyState } from "../../components/ui/EmptyState"

const GUIDE_SUMMARIES: Record<string, string> = {
  '/guides/faq': 'The questions that keep coming back: trade evolutions, items, shiny rate, grinding…',
  '/guides/npc': 'NPCs changed, moved or given new services (Move Relearner, Name Rater…).',
  '/guides/trades': 'The four in-game trades: Pokémon requested, Pokémon received, item, IVs and nature.',
  '/guides/level-caps': 'The recommended maximum level at each stage, to avoid over-levelling.',
  '/guides/action-replay': 'Action Replay codes shipped with the documentation, copyable in one click.',
  '/guides/changelog': 'Version history of the hack, most recent first.',
}

export function GuidesHub() {
  const { data: misc, loading } = useData(loadMisc)
  const { data: trainers } = useData(loadTrainers)
  const { data: changelog } = useData(loadChangelog)

  const levelCaps = (misc?.levelCaps.length ?? 0) > 0 ? misc?.levelCaps : trainers?.levelCaps
  const latest = changelog?.[0]

  const counts: Record<string, number> = {
    '/guides/faq': misc?.faq.length ?? 0,
    '/guides/npc': misc?.npc.length ?? 0,
    '/guides/trades': misc?.trades.length ?? 0,
    '/guides/level-caps': levelCaps?.length ?? 0,
    '/guides/action-replay': misc?.actionReplay.length ?? 0,
    '/guides/changelog': changelog?.length ?? 0,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Practical guides"
        subtitle="The cross-cutting information that fits no database: FAQ, NPCs, trades, level caps, Action Replay codes and version history."
        meta={
          <>
            <Badge tone="accent">{plural(GUIDE_LINKS.length, 'guide')}</Badge>
            {latest ? <Badge tone="outline">Latest version {latest.version}</Badge> : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDE_LINKS.map((guide) => (
          <CardLink key={guide.to} to={guide.to} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-muted">
                <Icon name={guide.icon} size={18} />
              </span>
              {counts[guide.to] > 0 ? (
                <Badge tone="outline" mono>
                  {counts[guide.to]}
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-ink">{guide.label}</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {GUIDE_SUMMARIES[guide.to] ?? guide.hint}
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted">
              Open the guide <Icon name="arrowRight" size={12} />
            </span>
          </CardLink>
        ))}
      </div>

      <section aria-labelledby="level-caps-preview" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="level-caps-preview" className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
              <Icon name="trending" size={17} className="text-ink-faint" />
              Level caps at a glance
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Recommended levels to stay in the spirit of the hack without over-levelling.
            </p>
          </div>
          <Link
            to="/guides/level-caps"
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            See all <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : (levelCaps?.length ?? 0) === 0 ? (
          <EmptyState inline icon="trending" title="No level cap documented" />
        ) : (
          <Card>
            <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(levelCaps ?? []).map((cap, index) => {
                const match = /^(.*?),\s*Lv\.\s*(\d+)/.exec(cap)
                return (
                  <li key={`${cap}-${index}`} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line py-1.5">
                    <span className="min-w-0 truncate text-sm text-ink-muted">{match ? match[1] : cap}</span>
                    <span className="nums shrink-0 font-mono text-sm font-bold text-ink">
                      {match ? match[2] : '—'}
                    </span>
                  </li>
                )
              })}
            </ol>
          </Card>
        )}
      </section>
    </div>
  )
}
