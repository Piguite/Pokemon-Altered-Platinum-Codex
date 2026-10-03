import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { TMLocationRow } from "../types/data"
import { cls, formatPrice, matches, plural } from "../lib/format"
import { loadItems, useData } from "../lib/data"
import { Badge, Card, Delta } from "../components/ui/Card"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"
import { PageHeader, SectionHeader } from "../components/ui/SectionHeader"
import { SearchField, Toolbar } from "../components/ui/Controls"
import { Tabs } from "../components/ui/Tabs"
import { DataTable } from "../components/ui/DataTable"
import type { Column } from "../components/ui/DataTable"
import { SkeletonRows } from "../components/ui/Skeleton"
import { BulletList, Callout, NoteSections } from "../components/ui/Prose"

type ItemsTab = 'prices' | 'tms' | 'shops' | 'locations' | 'notes'

/** Tabs whose content the search field filters, in the order they are tried. */
const SEARCHABLE_TABS: ItemsTab[] = ['prices', 'tms', 'locations']

const TM_COLUMNS: Column<TMLocationRow>[] = [
  {
    key: 'tm',
    header: 'TM',
    primary: true,
    sortable: true,
    className: 'w-20',
    sortValue: (row) => row.tm,
    cell: (row) => <span className="nums font-mono text-xs font-semibold text-ink">{row.tm}</span>,
  },
  {
    key: 'move',
    header: 'Move',
    sortable: true,
    sortValue: (row) => row.move,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{row.move}</span>
        {row.changed ? <Badge tone="accent">Changed</Badge> : null}
      </span>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    sortable: true,
    sortValue: (row) => row.location,
    cell: (row) => <span className="text-ink-muted">{row.location}</span>,
  },
  {
    key: 'obtained',
    header: 'Obtained',
    cell: (row) => <span className="text-xs text-ink-muted">{row.obtained || '—'}</span>,
  },
]

export function ItemsView() {
  const { data: doc, loading } = useData(loadItems)
  const [params, setParams] = useSearchParams()
  const queryFromUrl = params.get('q') ?? ''
  const [query, setQuery] = useState(queryFromUrl)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'tm', dir: 'asc' })

  const tab = (params.get('tab') as ItemsTab) ?? 'prices'
  const safeTab: ItemsTab = ['prices', 'tms', 'shops', 'locations', 'notes'].includes(tab) ? tab : 'prices'

  function setTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    setParams(next, { replace: true })
  }

  /* A search result links to `#/items?q=<item>` — the query must reach the input. */
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

  const costs = useMemo(() => {
    const list = doc?.costChanges ?? []
    if (!query.trim()) return list
    return list.filter((entry) => matches(`${entry.item} ${entry.raw}`, query))
  }, [doc, query])

  const locations = useMemo(() => {
    const list = doc?.itemLocations ?? []
    if (!query.trim()) return list
    return list.filter((entry) => matches(`${entry.item} ${entry.locations}`, query))
  }, [doc, query])

  const tms = useMemo(() => {
    const list = doc?.tmLocations ?? []
    if (!query.trim()) return list
    return list.filter((entry) => matches(`${entry.tm} ${entry.move} ${entry.location} ${entry.obtained}`, query))
  }, [doc, query])

  const replacements = useMemo(() => {
    const list = doc?.replacedItems ?? []
    if (!query.trim()) return list
    return list.filter((entry) => matches(`${entry.oldItem} ${entry.newItem} ${entry.note ?? ''}`, query))
  }, [doc, query])

  const counts: Record<ItemsTab, number> = {
    prices: costs.length,
    tms: tms.length,
    shops: 0,
    locations: locations.length,
    notes: 0,
  }
  const matchKey = SEARCHABLE_TABS.map((entry) => counts[entry]).join(',')

  /*
   * Landing from a search result: show the section that actually contains the
   * searched item instead of an empty tab. Runs once per distinct `?q=`, so a
   * manual tab click is respected afterwards.
   */
  const appliedQuery = useRef('')
  /* `counts` is derived from the lists above; `matchKey` is its stable identity. */
  useEffect(() => {
    if (!queryFromUrl || loading) return
    if (appliedQuery.current === queryFromUrl) return
    appliedQuery.current = queryFromUrl
    if (counts[safeTab] > 0) return
    const first = SEARCHABLE_TABS.find((entry) => counts[entry] > 0)
    if (first) setTab(first)
  }, [queryFromUrl, loading, matchKey, safeTab])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        subtitle="Revised prices, item replacements, new usage compatibility, shop stock, and item and TM locations."
        meta={
          <>
            <Badge tone="accent">{plural(doc?.costChanges.length ?? 0, 'price change')}</Badge>
            <Badge tone="outline">{plural(doc?.tmLocations.length ?? 0, 'TM located', 'TMs located')}</Badge>
            <Badge tone="outline">{plural(doc?.usableItems.length ?? 0, 'usable item')}</Badge>
          </>
        }
      />

      <Tabs
        label="Item sections"
        value={safeTab}
        onChange={setTab}
        tabs={[
          { id: 'prices', label: 'Prices & trades', count: doc?.costChanges.length },
          { id: 'tms', label: 'TMs / Moves', count: doc?.tmLocations.length },
          { id: 'shops', label: 'Shops', count: doc?.martChanges.length },
          { id: 'locations', label: 'Locations', count: doc?.itemLocations.length },
          { id: 'notes', label: 'Notes' },
        ]}
      />

      {safeTab !== 'shops' && safeTab !== 'notes' ? (
        <Toolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            label="Search for an item"
            placeholder="Item, TM or place name…"
            className="sm:max-w-md sm:flex-1"
          />
        </Toolbar>
      ) : null}

      {loading ? <SkeletonRows rows={8} /> : null}

      {/* ------------------------------------------------------- Prices */}
      {!loading && safeTab === 'prices' ? (
        <div className="space-y-5">
          <Card padded={false} className="overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Price adjustments</h2>
            </div>
            {costs.length === 0 ? (
              <div className="p-6">
                <EmptyState inline icon="tag" title="No price matches" />
              </div>
            ) : (
              <ul>
                {costs.map((entry) => {
                  const delta =
                    entry.oldPrice !== null && entry.newPrice !== null ? entry.newPrice - entry.oldPrice : null
                  const cheaper = delta !== null && delta < 0
                  return (
                    <li
                      key={entry.item + entry.raw}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink">{entry.item}</span>
                      <span className="nums flex items-center gap-2 font-mono text-xs">
                        <span className="text-ink-faint line-through">{formatPrice(entry.oldPrice)}</span>
                        <Icon name="arrowRight" size={13} className="text-ink-faint" />
                        <span
                          className={cls(
                            'rounded-pill px-2 py-0.5 font-semibold',
                            cheaper
                              ? 'bg-good/15 text-good'
                              : delta && delta > 0
                                ? 'bg-bad/15 text-bad'
                                : 'bg-surface-3 text-ink',
                          )}
                        >
                          {formatPrice(entry.newPrice)}
                        </span>
                        {delta !== null ? <Delta value={delta} suffix="$" /> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {(doc?.usableItems.length ?? 0) > 0 ? (
            <Card>
              <SectionHeader
                eyebrow="New"
                title="Items that are now “usable”"
                icon="sparkles"
                subtitle="They are used exactly like an evolution stone, with no trading involved."
                className="mb-3"
              />
              <ul className="flex flex-wrap gap-1.5">
                {(doc?.usableItems ?? []).map((item) => (
                  <li
                    key={item}
                    className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {replacements.length > 0 ? (
            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-line bg-surface-2 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-ink">Replaced items</h2>
              </div>
              <ul>
                {replacements.map((entry) => (
                  <li
                    key={`${entry.oldItem}-${entry.newItem}`}
                    className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span className="text-sm text-ink-faint line-through">{entry.oldItem}</span>
                    <Icon name="arrowRight" size={13} className="text-ink-faint" />
                    <span className="text-sm font-medium text-ink">{entry.newItem}</span>
                    {entry.note ? <span className="text-xs text-ink-muted">— {entry.note}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* ---------------------------------------------------------- TMs */}
      {!loading && safeTab === 'tms' ? (
        <div className="space-y-5">
          {(doc?.tmChanges.length ?? 0) > 0 ? (
            <Card>
              <SectionHeader eyebrow="Contents" title="Changed TMs" icon="swap" className="mb-3" />
              <ul className="grid gap-2 sm:grid-cols-2">
                {(doc?.tmChanges ?? []).map((entry) => (
                  <li
                    key={`${entry.tm}-${entry.move}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    <span className="nums font-mono text-xs font-semibold text-ink">{entry.tm}</span>
                    <Icon name="arrowRight" size={13} className="text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.move}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <DataTable
            rows={tms}
            columns={TM_COLUMNS}
            getKey={(row, index) => `${row.tm}-${row.location}-${index}`}
            sort={sort}
            onSortChange={setSort}
            empty={<EmptyState inline icon="tag" title="No TM matches" />}
          />

          {(doc?.vitaminReplacements.length ?? 0) > 0 ? (
            <Card>
              <SectionHeader eyebrow="Replacements" title="Vitamins" icon="tag" className="mb-3" />
              <BulletList lines={doc?.vitaminReplacements ?? []} />
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------- Shops */}
      {!loading && safeTab === 'shops' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader eyebrow="Shops" title="Modified stock" icon="tag" className="mb-3" />
            <BulletList lines={doc?.martChanges ?? []} dense />
          </Card>
          <Card>
            <SectionHeader eyebrow="Department store" title="Dept. Store stock" icon="list" className="mb-3" />
            <BulletList lines={doc?.deptStoreStock ?? []} dense />
          </Card>
        </div>
      ) : null}

      {/* ---------------------------------------------------- Locations */}
      {!loading && safeTab === 'locations' ? (
        <div className="space-y-5">
          <Card padded={false} className="overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Item locations</h2>
            </div>
            {locations.length === 0 ? (
              <div className="p-6">
                <EmptyState inline icon="mapPin" title="No location matches" />
              </div>
            ) : (
              <ul>
                {locations.map((entry) => (
                  <li key={entry.item} className="border-b border-line px-4 py-3 last:border-b-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Icon name="mapPin" size={14} className="shrink-0 text-ink-faint" />
                      {entry.item}
                    </p>
                    <p className="mt-1 pl-6 text-xs leading-relaxed text-ink-muted">{entry.locations}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(doc?.plateLocations.length ?? 0) > 0 ? (
            <Card>
              <SectionHeader eyebrow="Plates" title="Plate locations" icon="layers" className="mb-3" />
              <BulletList lines={doc?.plateLocations ?? []} />
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------- Notes */}
      {!loading && safeTab === 'notes' ? (
        <div className="space-y-4">
          {(doc?.generalNotes.length ?? 0) > 0 ? (
            <Callout tone="info" title="General notes">
              <BulletList lines={doc?.generalNotes ?? []} icon={null} dense />
            </Callout>
          ) : null}
          {(doc?.noteSections.length ?? 0) > 0 ? (
            <Card>
              <NoteSections sections={doc?.noteSections ?? []} />
            </Card>
          ) : null}
          {(doc?.generalNotes.length ?? 0) === 0 && (doc?.noteSections.length ?? 0) === 0 ? (
            <EmptyState inline icon="clipboard" title="No additional notes" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
