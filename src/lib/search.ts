import Fuse from 'fuse.js'
import type { FuseResultMatch, IFuseOptions } from 'fuse.js'
import { useEffect, useMemo, useState } from 'react'
import type { SearchKind, SearchRecord } from "../types/data"
import { loadSearchIndex } from './data'

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  pokemon: 'Pokémon',
  sinnohan: 'Sinnohan forms',
  type: 'Type changes',
  move: 'Moves',
  item: 'Items',
  evolution: 'Evolutions',
  trainer: 'Trainers',
  wild: 'Wild encounters',
  event: 'Events',
  npc: 'NPCs',
  trade: 'Trades',
  faq: 'FAQ',
  guide: 'Guides',
  doc: 'Documents',
}

/**
 * Order in which groups appear in the palette / results page.
 * Concrete entities come first so that typing "charizard" leads with the
 * Charizard entry rather than a document that merely mentions it.
 */
export const SEARCH_KIND_ORDER: SearchKind[] = [
  'pokemon',
  'sinnohan',
  'type',
  'move',
  'item',
  'evolution',
  'trainer',
  'wild',
  'event',
  'trade',
  'npc',
  'faq',
  'guide',
  'doc',
]

export function kindLabel(kind: SearchKind | string): string {
  return SEARCH_KIND_LABELS[kind as SearchKind] ?? String(kind)
}

const FUSE_OPTIONS: IFuseOptions<SearchRecord> = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  /*
   * 0.28 rather than Fuse's usual 0.34.
   *
   * The index mixes short titles with long `body` fields, and `ignoreLocation`
   * lets a pattern match anywhere inside them — so a 9-character query could
   * find a 3-edit window in some unrelated Pokémon's move list. Measured on the
   * real index, dropping to 0.28 removes that noise entirely (queries with no
   * genuine match in the corpus went from 22/13/19 hits to 0, while every
   * legitimate query kept its exact result set) and still tolerates typos such
   * as `charizrd`, `leftver` and `hydropmp`.
   */
  threshold: 0.28,
  minMatchCharLength: 2,
  shouldSort: true,
  keys: [
    { name: 'title', weight: 0.55 },
    { name: 'subtitle', weight: 0.22 },
    { name: 'badges', weight: 0.13 },
    { name: 'body', weight: 0.1 },
  ],
}

export interface SearchHit {
  record: SearchRecord
  score: number
  matches: readonly FuseResultMatch[]
}

export interface SearchGroup {
  kind: SearchKind
  hits: SearchHit[]
}

/** Loads `search-index.json` once and exposes a ready-to-use Fuse instance. */
export function useSearchIndex(): { index: SearchRecord[]; fuse: Fuse<SearchRecord> | null; loading: boolean } {
  const [index, setIndex] = useState<SearchRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    loadSearchIndex().then((records) => {
      if (alive) setIndex(Array.isArray(records) ? records : [])
    })
    return () => {
      alive = false
    }
  }, [])

  const fuse = useMemo(() => (index && index.length > 0 ? new Fuse(index, FUSE_OPTIONS) : null), [index])

  return { index: index ?? [], fuse, loading: index === null }
}

export function runSearch(
  fuse: Fuse<SearchRecord> | null,
  query: string,
  limit: number,
  kinds?: ReadonlySet<SearchKind>,
): SearchHit[] {
  const trimmed = query.trim()
  if (!fuse || trimmed.length < 1) return []
  const raw = fuse.search(trimmed, { limit: limit * 3 })
  const hits: SearchHit[] = []
  for (const result of raw) {
    const matches = result.matches ?? []
    // A result with no recorded match range is score-only noise.
    if (matches.length === 0) continue
    if (kinds && kinds.size > 0 && !kinds.has(result.item.kind)) continue
    hits.push({
      record: result.item,
      score: result.score ?? 1,
      matches,
    })
    if (hits.length >= limit) break
  }
  return hits
}

/** Groups hits in the canonical kind order so the palette reads predictably. */
export function groupHits(hits: SearchHit[]): SearchGroup[] {
  const byKind = new Map<SearchKind, SearchHit[]>()
  for (const hit of hits) {
    const bucket = byKind.get(hit.record.kind)
    if (bucket) bucket.push(hit)
    else byKind.set(hit.record.kind, [hit])
  }
  return SEARCH_KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    hits: byKind.get(kind) ?? [],
  }))
}

/** Splits a string into matched / unmatched chunks for highlighting. */
export interface HighlightChunk {
  text: string
  hit: boolean
}

export function highlight(text: string, matches: readonly FuseResultMatch[] | undefined, key: string): HighlightChunk[] {
  const match = matches?.find((m) => m.key === key)
  if (!match || !match.indices || match.indices.length === 0) return [{ text, hit: false }]
  const chunks: HighlightChunk[] = []
  let cursor = 0
  for (const [start, end] of match.indices) {
    if (start > cursor) chunks.push({ text: text.slice(cursor, start), hit: false })
    chunks.push({ text: text.slice(start, end + 1), hit: true })
    cursor = end + 1
  }
  if (cursor < text.length) chunks.push({ text: text.slice(cursor), hit: false })
  return chunks.filter((c) => c.text.length > 0)
}

/** Shared static shortcuts offered when the palette opens with no query. */
export const SEARCH_SHORTCUTS: { label: string; hint: string; route: string }[] = [
  { label: 'Dashboard', hint: 'Overview of the hack', route: '#/' },
  { label: 'Modified Pokémon', hint: 'Types, stats, abilities, learnsets', route: '#/pokemon' },
  { label: 'Sinnohan forms', hint: 'Types, abilities, learnsets', route: '#/sinnohan' },
  { label: 'Type chart', hint: 'Ice rework and type changes', route: '#/types' },
  { label: 'Moves', hint: 'Replacements, new moves', route: '#/moves' },
  { label: 'Items & prices', hint: 'Prices, TMs, shop stock', route: '#/items' },
  { label: 'Evolutions', hint: 'Items, levels, methods', route: '#/evolutions' },
  { label: 'Trainers', hint: 'Rosters by area & bosses', route: '#/trainers' },
  { label: 'Wild encounters', hint: 'By area and method', route: '#/wild' },
  { label: 'Events', hint: 'Gifts, statics, trades', route: '#/events' },
  { label: 'Level caps', hint: 'Recommended levels', route: '#/guides/level-caps' },
  { label: 'FAQ', hint: 'Frequently asked questions', route: '#/guides/faq' },
]
