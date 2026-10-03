import { useMemo, useState } from 'react'
import { loadMisc, useData } from "../../lib/data"
import { matches, plural } from "../../lib/format"
import { Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Icon } from "../../components/ui/Icon"
import { BulletList } from "../../components/ui/Prose"
import { SearchField, Toolbar } from "../../components/ui/Controls"
import { PageHeader } from "../../components/ui/SectionHeader"
import { SkeletonText } from "../../components/ui/Skeleton"

export function NpcView() {
  const { data: misc, loading } = useData(loadMisc)
  const [query, setQuery] = useState('')

  const sections = useMemo(() => {
    const list = misc?.npc ?? []
    if (!query.trim()) return list
    return list.filter((section) => matches(`${section.title} ${section.lines.join(' ')}`, query))
  }, [misc, query])

  return (
    <div className="space-y-6">
      <PageHeader
        title="NPC changes"
        subtitle="Characters moved, new services and practical changes that belong to no database."
        meta={<span className="text-xs text-ink-muted">{plural(misc?.npc.length ?? 0, 'section')}</span>}
      />

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          label="Search for an NPC change"
          placeholder="NPC, service or place name…"
          className="sm:max-w-md sm:flex-1"
        />
      </Toolbar>

      {loading ? (
        <SkeletonText lines={8} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="users"
          title="No NPC change matches"
          description="Try another keyword, or use the global search (⌘K)."
        />
      ) : (
        <ul className="space-y-3">
          {sections.map((section) => (
            <li key={section.title}>
              <Card className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
                  <Icon name="users" size={15} className="text-ink-faint" />
                  {section.title}
                </h2>
                <BulletList lines={section.lines} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
