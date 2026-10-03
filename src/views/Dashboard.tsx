import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentStat, MetaDoc, NoteSection } from "../types/data"
import { cls, plural } from "../lib/format"
import { loadMeta, useData } from "../lib/data"
import { NAV_ITEMS } from "../lib/routes"
import { Icon } from "../components/ui/Icon"
import type { IconName } from "../components/ui/Icon"
import { Badge, Card } from "../components/ui/Card"
import { BulletList } from "../components/ui/Prose"
import { SearchField } from "../components/ui/Controls"
import { SkeletonGrid, SkeletonText } from "../components/ui/Skeleton"
import { SectionHeader } from "../components/ui/SectionHeader"
import { EmptyState } from "../components/ui/EmptyState"

interface Headline {
  key: keyof MetaDoc['counts']
  label: string
  to: string
  icon: IconName
}

const HEADLINES: Headline[] = [
  { key: 'pokemon', label: 'Modified Pokémon', to: '/pokemon', icon: 'pokeball' },
  { key: 'pokemonWithTypeChange', label: 'Type changes', to: '/types', icon: 'grid' },
  { key: 'sinnohan', label: 'Sinnohan forms', to: '/sinnohan', icon: 'sparkles' },
  { key: 'typeChartChanges', label: 'Type chart cells', to: '/types', icon: 'snowflake' },
  { key: 'moveReplacements', label: 'Replaced moves', to: '/moves', icon: 'swap' },
  { key: 'newMoves', label: 'New moves', to: '/moves', icon: 'zap' },
  { key: 'moveModifications', label: 'Modified moves', to: '/moves', icon: 'list' },
  { key: 'costChanges', label: 'Price changes', to: '/items', icon: 'tag' },
  { key: 'trainers', label: 'Trainers listed', to: '/trainers', icon: 'users' },
  { key: 'wildAreas', label: 'Wild areas', to: '/wild', icon: 'mapPin' },
  { key: 'events', label: 'Events', to: '/events', icon: 'gift' },
  { key: 'trades', label: 'In-game trades', to: '/guides/trades', icon: 'swap' },
]

const INTRO =
  'Pokémon Altered Platinum is a difficulty overhaul of Pokémon Platinum by Drayano: a new type chart, ' +
  'stats aligned with Ultra Sun / Ultra Moon, Sinnohan regional forms and fully reworked trainer rosters.'

function CountTile({ headline, value }: { headline: Headline; value: number }) {
  return (
    <Link
      to={headline.to}
      className="group rounded-card border border-line bg-surface p-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <span className="flex items-center gap-2 text-ink-faint">
        <Icon name={headline.icon} size={15} />
        <span className="text-[11px] font-medium tracking-wide uppercase">{headline.label}</span>
      </span>
      <span className="nums mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tracking-tight text-ink">{value.toLocaleString('en-US')}</span>
        <Icon
          name="arrowRight"
          size={14}
          className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
        />
      </span>
    </Link>
  )
}

function DocumentRow({ doc, active, onSelect }: { doc: DocumentStat; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cls(
        'w-full rounded-lg border px-3.5 py-3 text-left transition-colors',
        active ? 'border-line-strong bg-surface-3' : 'border-transparent hover:bg-surface-2',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink">{doc.title}</span>
        {doc.entryCount > 0 ? (
          <span className="nums shrink-0 font-mono text-[11px] text-ink-faint">{doc.entryCount}</span>
        ) : null}
      </span>
      <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-faint">{doc.file}</span>
    </button>
  )
}

export function Dashboard() {
  const { data: meta, loading } = useData(loadMeta)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const documents = meta?.documents ?? []
  const withNotes = useMemo(() => documents.filter((doc) => doc.generalNotes.length > 0), [documents])

  const filteredDocs = useMemo(() => {
    if (!filter.trim()) return withNotes
    const needle = filter.toLowerCase()
    return withNotes.filter(
      (doc) =>
        doc.title.toLowerCase().includes(needle) ||
        doc.summary.toLowerCase().includes(needle) ||
        doc.generalNotes.some((section) => section.title.toLowerCase().includes(needle)),
    )
  }, [withNotes, filter])

  const activeDoc = useMemo(() => {
    if (filteredDocs.length === 0) return null
    return filteredDocs.find((doc) => doc.id === activeDocId) ?? filteredDocs[0]
  }, [filteredDocs, activeDocId])

  const digest: NoteSection[] = activeDoc?.generalNotes ?? []

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden rounded-card border border-line bg-surface">
        <div className="bg-grid absolute inset-0 opacity-[0.35]" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="absolute -top-28 -right-24 size-72 rounded-full bg-accent/12 blur-3xl"
        />
        <div className="relative px-5 py-7 sm:px-8 sm:py-10">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            <Icon name="pokeball" size={14} />
            Pokémon Altered Platinum
          </p>
          <h1 className="mt-3 max-w-3xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl lg:text-[2.1rem]">
            The <span className="text-gradient-accent">ultimate game change codex</span>.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.9375rem]">{INTRO}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              to="/pokemon"
              className="inline-flex items-center gap-2 rounded-pill bg-accent-solid px-4 py-2.5 text-sm font-semibold text-accent-ink transition-transform hover:-translate-y-0.5"
            >
              <Icon name="pokeball" size={16} />
              Browse the {meta ? meta.counts.pokemon.toLocaleString('en-US') : ''} Pokémon
            </Link>
            <Link
              to="/types"
              className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink-faint"
            >
              <Icon name="grid" size={16} />
              Type chart
            </Link>
            <Link
              to="/sinnohan"
              className="inline-flex items-center gap-2 rounded-pill border border-line-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink-faint"
            >
              <Icon name="sparkles" size={16} />
              Sinnohan forms
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone="accent">Global search ⌘K</Badge>
            <Badge tone="outline">Vanilla / Altered comparison</Badge>
            <Badge tone="outline">Complete learnsets</Badge>
            <Badge tone="outline">Shareable links</Badge>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Counts */}
      <section aria-labelledby="key-figures">
        <SectionHeader
          id="key-figures"
          title="Key figures"
          subtitle="Everything the source documents cover, at a glance."
          icon="trending"
        />
        {loading || !meta ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[86px] animate-pulse rounded-card border border-line bg-surface" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HEADLINES.map((headline) => (
              <CountTile key={headline.key} headline={headline} value={meta.counts[headline.key]} />
            ))}
          </div>
        )}
      </section>

      {/*
        rev 2: the documents only record *changes*, so base stats and the TM/tutor
        lists were completed from the vanilla Platinum baseline. Say where that
        data comes from, quietly, once.
      */}
      {meta?.enrichment ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          <span>
            The hack's documents list only <em>changes</em>: base stats, the TM/HM lists and the Move Tutor
            lists were completed from{' '}
            <span className="text-ink-muted">{meta.enrichment.source}</span>
            {meta.enrichment.statsFilled > 0 ? ` — ${plural(meta.enrichment.statsFilled, 'entry', 'entries')}` : ''}
            {meta.enrichment.tmFilled > 0
              ? `, ${plural(meta.enrichment.tmFilled, 'TM/HM list')}`
              : ''}
            {meta.enrichment.tutorFilled > 0
              ? `, ${plural(meta.enrichment.tutorFilled, 'Move Tutor list')}`
              : ''}
            .
          </span>
        </p>
      ) : null}

      <section aria-labelledby="general-changes">
        <SectionHeader
          id="general-changes"
          eyebrow="Digest"
          title="General changes"
          subtitle="The preambles written by the author, grouped by document. Pick a document on the left."
          icon="clipboard"
          action={
            activeDoc ? (
              <Link
                to={activeDoc.route.replace(/^#/, '')}
                className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Open {activeDoc.title}
                <Icon name="arrowRight" size={13} />
              </Link>
            ) : null
          }
        />

        {loading || !meta ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <SkeletonText lines={6} />
            <SkeletonText lines={10} />
          </div>
        ) : withNotes.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="clipboard"
            title="No preamble available"
            description="The documents contain no usable general section."
          />
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="rounded-card border border-line bg-surface p-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
              <SearchField
                value={filter}
                onChange={setFilter}
                label="Filter documents"
                placeholder="Filter documents…"
                size="sm"
                onClear={() => setFilter('')}
              />
              {/* At `lg` the list fills whatever height the document card beside
                  it needs, so the two columns stay level however long the
                  selected document is. Below `lg` the columns stack, and a
                  bound is kept so a long list cannot push the content away. */}
              <ul className="mt-2 max-h-[26rem] space-y-0.5 overflow-y-auto scroll-thin lg:max-h-none lg:min-h-0 lg:flex-1">
                {filteredDocs.map((doc) => (
                  <li key={doc.id}>
                    <DocumentRow
                      doc={doc}
                      active={activeDoc?.id === doc.id}
                      onSelect={() => setActiveDocId(doc.id)}
                    />
                  </li>
                ))}
                {filteredDocs.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-ink-faint">No document matches.</li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
              {activeDoc ? (
                <>
                  <div className="mb-4 border-b border-line pb-3">
                    <h3 className="text-base font-bold tracking-tight text-ink">{activeDoc.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{activeDoc.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {activeDoc.version ? <Badge tone="outline">Version {activeDoc.version}</Badge> : null}
                      {activeDoc.entryCount > 0 ? (
                        <Badge tone="neutral">{plural(activeDoc.entryCount, 'entry', 'entries')}</Badge>
                      ) : null}
                      <span className="font-mono text-[11px] text-ink-faint">{activeDoc.file}</span>
                    </div>
                  </div>
                  <div className="max-h-[32rem] space-y-6 overflow-y-auto scroll-thin pr-1">
                    {digest.map((section, index) => (
                      <div key={`${section.title}-${index}`}>
                        <h4 className="mb-2 text-sm font-semibold text-ink">{section.title}</h4>
                        <BulletList lines={section.lines} dense />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* --------------------------------------------------- Entry points */}
      <section aria-labelledby="entry-points">
        <SectionHeader
          id="entry-points"
          title="Entry points"
          subtitle="Each section maps to a source document. Everything is filterable and shareable by URL."
          icon="list"
        />
        {loading || !meta ? (
          <SkeletonGrid count={6} className="mt-4" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_ITEMS.filter((item) => item.to !== '/').map((item) => {
              const doc = documents.find((d) => d.route.endsWith(item.to))
              return (
                <Card key={item.to} padded={false} className="overflow-hidden">
                  <Link to={item.to} className="group flex h-full flex-col p-4 sm:p-5">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
                        <Icon name={item.icon} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
                        <span className="block truncate text-xs text-ink-faint">{item.hint}</span>
                      </span>
                      <Icon
                        name="arrowRight"
                        size={15}
                        className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </span>
                    <span className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-muted">
                      {doc?.summary ?? 'Open the section.'}
                    </span>
                    {doc && doc.entryCount > 0 ? (
                      <span className="mt-3">
                        <Badge tone="outline">{plural(doc.entryCount, 'entry', 'entries')}</Badge>
                      </span>
                    ) : null}
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
