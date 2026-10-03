import { loadChangelog, useData } from "../../lib/data"
import { plural } from "../../lib/format"
import { Badge, Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { BulletList } from "../../components/ui/Prose"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonText } from "../../components/ui/Skeleton"

function formatDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ChangelogView() {
  const { data: entries, loading } = useData(loadChangelog)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changelog"
        subtitle="Version history of the hack, most recent first, as shipped in the release archive."
        meta={<Badge tone="accent">{plural(entries?.length ?? 0, 'version')}</Badge>}
      />

      {loading ? (
        <SkeletonText lines={12} />
      ) : (entries?.length ?? 0) === 0 ? (
        <EmptyState icon="clipboard" title="No changelog available" description="The Changelog.txt file has not been fetched." />
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {(entries ?? []).map((entry, index) => (
            <li key={`${entry.version}-${index}`} className="relative">
              <span
                aria-hidden="true"
                className={`absolute top-5 -left-[26px] size-2.5 rounded-full ring-4 ring-canvas ${
                  index === 0 ? 'bg-accent' : 'bg-line-strong'
                }`}
              />
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
                    <Icon name="clipboard" size={15} className="text-ink-faint" />
                    {entry.version}
                    {index === 0 ? <Badge tone="accent">Latest</Badge> : null}
                  </h2>
                  {formatDate(entry.date) ? (
                    <span className="text-xs text-ink-muted">{formatDate(entry.date)}</span>
                  ) : null}
                </div>
                <BulletList lines={entry.lines} dense />
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
