import { useEffect, useState, useSyncExternalStore } from 'react'
import type {
  ChangelogEntry,
  ChangeKind,
  EventsDoc,
  EvolutionsDoc,
  FormVariant,
  ItemsDoc,
  LearnEntry,
  Learnset,
  MetaDoc,
  MiscDoc,
  MoveFieldChange,
  MoveFieldException,
  MoveModification,
  MoveNote,
  MovesDoc,
  NewMove,
  NoteSection,
  PokemonChange,
  RawSection,
  SearchRecord,
  SinnohanForm,
  StatBlock,
  TMLearn,
  TrainersDoc,
  TutorLearn,
  TypeChangesDoc,
  WildDoc,
} from "../types/data"
import {
  FIXTURE_CHANGELOG,
  FIXTURE_EVENTS,
  FIXTURE_EVOLUTIONS,
  FIXTURE_ITEMS,
  FIXTURE_META,
  FIXTURE_MISC,
  FIXTURE_MOVES,
  FIXTURE_POKEMON,
  FIXTURE_SEARCH,
  FIXTURE_SINNOHAN,
  FIXTURE_TRAINERS,
  FIXTURE_TYPE_CHANGES,
  FIXTURE_WILD,
} from './fixtures'

/* ------------------------------------------------------------------ */
/* Status store — drives the "data is still being generated" banner. */
/* ------------------------------------------------------------------ */

export interface DataStatus {
  /** At least one JSON file could not be loaded (fixtures are in use). */
  degraded: boolean
  /** Filenames that failed, in load order. */
  missing: string[]
  /** How many files loaded successfully. */
  loaded: number
  /** How many loaders have settled at all. */
  settled: number
}

const listeners = new Set<() => void>()
const missingFiles = new Set<string>()
const pending = new Set<string>()
let loadedCount = 0
let snapshot: DataStatus = { degraded: false, missing: [], loaded: 0, settled: 0 }

function emit(): void {
  snapshot = {
    degraded: missingFiles.size > 0,
    missing: [...missingFiles],
    loaded: loadedCount,
    settled: loadedCount + missingFiles.size,
  }
  for (const listener of listeners) listener()
}

function subscribeStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getStatus(): DataStatus {
  return snapshot
}

/** React hook exposing the global data-loading status. */
export function useDataStatus(): DataStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus)
}

/* ------------------------------------------------------------------ */
/* Fetch layer — cached, fails soft, never throws.                     */
/* ------------------------------------------------------------------ */

export const DATA_FILES = {
  meta: 'meta.json',
  pokemon: 'pokemon.json',
  sinnohan: 'sinnohan.json',
  typeChanges: 'type-changes.json',
  moves: 'moves.json',
  items: 'items.json',
  evolutions: 'evolutions.json',
  trainers: 'trainers.json',
  wild: 'wild.json',
  events: 'events.json',
  misc: 'misc.json',
  changelog: 'changelog.json',
  searchIndex: 'search-index.json',
} as const

const cache = new Map<string, Promise<unknown>>()

function dataUrl(file: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}data/${file}`
}

/**
 * Fetch `<base>data/<file>` once per session.
 *
 * On any failure (404 while the pipeline is still running, malformed JSON,
 * offline `file://` browsing) the typed fixture is returned instead and the
 * file is recorded as missing so the UI can say so discreetly.
 */
function fetchJson<T>(file: string, fallback: () => T): Promise<T> {
  const cached = cache.get(file)
  if (cached) return cached as Promise<T>

  pending.add(file)
  const task = (async (): Promise<T> => {
    try {
      const response = await fetch(dataUrl(file))
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${file}`)
      const json: unknown = await response.json()
      if (json === null || json === undefined) throw new Error(`Empty payload for ${file}`)
      loadedCount += 1
      return json as T
    } catch {
      missingFiles.add(file)
      return fallback()
    } finally {
      pending.delete(file)
      emit()
    }
  })()

  cache.set(file, task)
  return task
}

/* ------------------------------------------------------------------ */
/* rev 2 normalisation                                                 */
/*                                                                     */
/* `public/data/*.json` is produced by a pipeline that runs in its own  */
/* process, so the app can meet three generations of a file at once:    */
/*   - the pre-rev-2 build still on disk,                              */
/*   - the rev-2 build while it is being written,                      */
/*   - the final rev-2 build.                                           */
/*                                                                     */
/* Everything below accepts the loose JSON, repairs the shapes that     */
/* changed in rev 2 and guarantees the arrays the UI iterates over.     */
/* Nothing here invents game data: unknown/missing fields stay missing. */
/* ------------------------------------------------------------------ */

type Loose = Record<string, unknown>

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringList(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string')
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

const CHANGE_KINDS: ChangeKind[] = [
  'form',
  'type',
  'stats',
  'ability',
  'moves',
  'learnset',
  'evolution',
  'item',
  'other',
]

function isChangeKind(value: unknown): value is ChangeKind {
  return typeof value === 'string' && (CHANGE_KINDS as string[]).includes(value)
}

/**
 * rev 3: the pipeline tags every Sinnohan entry with the `form` kind itself
 * (`changeKinds: ["form"]` on all 65 entries), so nothing is rewritten here any
 * more. The kind is filtered through `isChangeKind`, which is what keeps an
 * unknown value from reaching the badge maps.
 */
function normalizeChangeKinds(raw: unknown): ChangeKind[] {
  return [...new Set(asArray(raw).filter(isChangeKind))]
}

/** `TutorLearn` replaced a bare `string[]` in rev 2 — accept both. */
function normalizeTutor(raw: unknown): TutorLearn[] {
  const out: TutorLearn[] = []
  for (const entry of asArray(raw)) {
    if (typeof entry === 'string') {
      const move = entry.trim()
      if (move) out.push({ move })
      continue
    }
    if (!isRecord(entry)) continue
    const move = asString(entry.move).trim()
    if (!move) continue
    out.push(entry.isNew === true ? { move, isNew: true } : { move })
  }
  return out
}

function normalizeLearnset(raw: unknown): Learnset {
  const loose = isRecord(raw) ? raw : {}
  const levelUp: LearnEntry[] = []
  for (const entry of asArray(loose.levelUp)) {
    if (!isRecord(entry) || typeof entry.level !== 'number') continue
    const move = asString(entry.move)
    if (!move) continue
    levelUp.push({ ...(entry as unknown as LearnEntry), move, isNew: entry.isNew === true })
  }

  const tm: TMLearn[] = []
  for (const entry of asArray(loose.tm)) {
    if (!isRecord(entry)) continue
    const move = asString(entry.move).trim()
    if (!move) continue
    tm.push({ num: asString(entry.num), move, ...(entry.isNew === true ? { isNew: true } : {}) })
  }

  return {
    levelUp,
    tm,
    tutor: normalizeTutor(loose.tutor),
    ...(loose.includesBaseline === true ? { includesBaseline: true } : {}),
  }
}

function normalizeStatBlock(raw: unknown): StatBlock | undefined {
  if (!isRecord(raw)) return undefined
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'bst'] as const
  if (!keys.every((key) => typeof raw[key] === 'number')) return undefined
  return {
    hp: raw.hp as number,
    atk: raw.atk as number,
    def: raw.def as number,
    spa: raw.spa as number,
    spd: raw.spd as number,
    spe: raw.spe as number,
    bst: raw.bst as number,
  }
}

function normalizePokemon(raw: unknown): PokemonChange[] {
  const out: PokemonChange[] = []
  for (const item of asArray(raw)) {
    if (!isRecord(item)) continue
    const entry = item as unknown as PokemonChange
    const isSinnohan = entry.isSinnohan === true
    const baseStats = normalizeStatBlock(entry.baseStats)
    out.push({
      ...entry,
      isSinnohan,
      changeKinds: normalizeChangeKinds(entry.changeKinds),
      moves: asArray(entry.moves) as MoveNote[],
      forms: asArray(entry.forms) as FormVariant[],
      evolution: stringList(entry.evolution),
      sections: asArray(entry.sections) as RawSection[],
      learnset: normalizeLearnset(entry.learnset),
      ...(baseStats ? { baseStats } : {}),
    })
  }
  return out
}

/**
 * Only a crash guard: the contract guarantees a `stats` block, but a
 * half-written file must not take the whole route down.
 */
const EMPTY_STATS: StatBlock = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, bst: 0 }

function normalizeSinnohan(raw: unknown): SinnohanForm[] {
  const out: SinnohanForm[] = []
  for (const item of asArray(raw)) {
    if (!isRecord(item)) continue
    const loose = item as Loose
    const form = item as unknown as SinnohanForm
    const replacedTypes = stringList(loose.replacedTypes)
    const replacedStats = normalizeStatBlock(loose.replacedStats)
    out.push({
      ...form,
      types: stringList(form.types),
      abilities: stringList(form.abilities),
      stats: normalizeStatBlock(form.stats) ?? EMPTY_STATS,
      evolution: stringList(form.evolution),
      sections: asArray(form.sections) as RawSection[],
      learnset: normalizeLearnset(form.learnset),
      ...(replacedTypes.length > 0 ? { replacedTypes } : {}),
      ...(replacedStats ? { replacedStats } : {}),
    })
  }
  return out
}

function normalizeFieldChange(raw: unknown): MoveFieldChange | null {
  if (!isRecord(raw)) return null
  return { label: asString(raw.label), from: asString(raw.from), to: asString(raw.to) }
}

/** Prose that the pipeline can emit as a modification/group record. */
const GROUP_PROSE = /batch changes|multiple similar moves/i

/**
 * A record that is really a prose line (no change of its own) rather than a
 * modification. It belongs in `groupNotes`, and must not render as a card —
 * the "Batch changes made to multiple similar moves." line does exactly this.
 */
function isProseRecord(modification: MoveModification): boolean {
  return (
    modification.changes.length === 0 &&
    modification.exceptions.length === 0 &&
    GROUP_PROSE.test(`${modification.label} ${modification.moves.join(' ')}`)
  )
}

function normalizeModification(raw: unknown): MoveModification | null {
  if (!isRecord(raw)) return null
  const listed = stringList(raw.moves)
    .map((move) => move.trim())
    .filter(Boolean)
  const legacy = asString(raw.move).trim()
  const moves = listed.length > 0 ? listed : legacy ? [legacy] : []
  if (moves.length === 0) return null

  const label = asString(raw.label).trim() || moves.join(' / ')
  const changes: MoveFieldChange[] = []
  for (const entry of asArray(raw.changes)) {
    const change = normalizeFieldChange(entry)
    if (change) changes.push(change)
  }

  const exceptions: MoveFieldException[] = []
  for (const entry of asArray(raw.exceptions)) {
    const change = normalizeFieldChange(entry)
    if (!change) continue
    const owner = stringList(isRecord(entry) ? entry.moves : [])
      .map((move) => move.trim())
      .filter(Boolean)
    if (owner.length > 0) exceptions.push({ ...change, moves: owner })
  }

  return { label, moves, changes, exceptions }
}

function normalizeModifications(raw: unknown): MoveModification[] {
  const out: MoveModification[] = []
  for (const entry of asArray(raw)) {
    const modification = normalizeModification(entry)
    if (modification) out.push(modification)
  }
  return out
}

function normalizeMoves(raw: unknown): MovesDoc {
  const loose = isRecord(raw) ? raw : {}
  const modifications = normalizeModifications(loose.modifications)
  const grouped = normalizeModifications(loose.groupModifications)
  const groupNotes = stringList(loose.groupNotes)
    .map((note) => note.trim())
    .filter(Boolean)

  /*
   * The "Move Group Modifications" intro line is prose. Depending on the build
   * it shows up as a modification record, as the first grouped record, in
   * `groupNotes`, or in several of those at once. Keep it as the section's
   * introduction and nowhere else.
   */
  const groupStray = grouped.filter(isProseRecord)
  for (const note of groupStray) if (!groupNotes.includes(note.label)) groupNotes.push(note.label)

  const stray = modifications.filter(isProseRecord)
  for (const note of stray) if (!groupNotes.includes(note.label)) groupNotes.push(note.label)

  return {
    generalNotes: stringList(loose.generalNotes),
    replacements: asArray(loose.replacements) as MovesDoc['replacements'],
    newMoves: asArray(loose.newMoves) as NewMove[],
    modifications: modifications.filter((modification) => !stray.includes(modification)),
    groupModifications: grouped.filter((modification) => !groupStray.includes(modification)),
    groupNotes,
    noteSections: asArray(loose.noteSections) as NoteSection[],
  }
}

/* ------------------------------------------------------------------ */
/* Typed loaders                                                       */
/* ------------------------------------------------------------------ */

export function loadMeta(): Promise<MetaDoc> {
  return fetchJson<MetaDoc>(DATA_FILES.meta, () => FIXTURE_META)
}

export function loadPokemon(): Promise<PokemonChange[]> {
  return fetchJson<unknown>(DATA_FILES.pokemon, () => FIXTURE_POKEMON).then((raw) =>
    normalizePokemon(Array.isArray(raw) && raw.length === 0 ? FIXTURE_POKEMON : raw),
  )
}

export function loadSinnohan(): Promise<SinnohanForm[]> {
  return fetchJson<unknown>(DATA_FILES.sinnohan, () => FIXTURE_SINNOHAN).then((raw) =>
    normalizeSinnohan(Array.isArray(raw) && raw.length === 0 ? FIXTURE_SINNOHAN : raw),
  )
}

export function loadTypeChanges(): Promise<TypeChangesDoc> {
  return fetchJson<TypeChangesDoc>(DATA_FILES.typeChanges, () => FIXTURE_TYPE_CHANGES)
}

export function loadMoves(): Promise<MovesDoc> {
  return fetchJson<unknown>(DATA_FILES.moves, () => FIXTURE_MOVES).then(normalizeMoves)
}

export function loadItems(): Promise<ItemsDoc> {
  return fetchJson<ItemsDoc>(DATA_FILES.items, () => FIXTURE_ITEMS)
}

export function loadEvolutions(): Promise<EvolutionsDoc> {
  return fetchJson<EvolutionsDoc>(DATA_FILES.evolutions, () => FIXTURE_EVOLUTIONS)
}

export function loadTrainers(): Promise<TrainersDoc> {
  return fetchJson<TrainersDoc>(DATA_FILES.trainers, () => FIXTURE_TRAINERS)
}

export function loadWild(): Promise<WildDoc> {
  return fetchJson<WildDoc>(DATA_FILES.wild, () => FIXTURE_WILD)
}

export function loadEvents(): Promise<EventsDoc> {
  return fetchJson<EventsDoc>(DATA_FILES.events, () => FIXTURE_EVENTS)
}

export function loadMisc(): Promise<MiscDoc> {
  return fetchJson<MiscDoc>(DATA_FILES.misc, () => FIXTURE_MISC)
}

export function loadChangelog(): Promise<ChangelogEntry[]> {
  return fetchJson<ChangelogEntry[]>(DATA_FILES.changelog, () => FIXTURE_CHANGELOG)
}

export function loadSearchIndex(): Promise<SearchRecord[]> {
  return fetchJson<SearchRecord[]>(DATA_FILES.searchIndex, () => FIXTURE_SEARCH)
}

/** Sprite URL for a national dex number (may 404 — components degrade gracefully). */
export function spriteUrl(dex: number): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}sprites/${dex}.png`
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

export interface AsyncState<T> {
  data: T | null
  loading: boolean
}

/** Runs a loader (module-level, therefore referentially stable) once. */
export function useData<T>(loader: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    let alive = true
    loader().then((value) => {
      if (alive) setData(value)
    })
    return () => {
      alive = false
    }
  }, [loader])

  return { data, loading: data === null }
}

/** Normalises a lookup key so `/pokemon/Charizard` and `charizard` both work. */
export function keyOf(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Accepted spellings for one entity.
 *
 * `pokemon.json` and `sinnohan.json` disagree on Sinnohan keys: the former uses
 * the plain species slug (`caterpie`), the latter prefixes it (`sinnohan-caterpie`).
 * Every variant is therefore tried on both sides.
 */
function keyVariants(slug: string): Set<string> {
  const key = keyOf(decodeURIComponent(slug))
  const bare = key.replace(/^sinnohan-/, '')
  return new Set([key, bare, `sinnohan-${bare}`])
}

export function findPokemon(list: PokemonChange[], slug: string): PokemonChange | undefined {
  const variants = keyVariants(slug)
  return (
    list.find((entry) => variants.has(entry.slug)) ??
    list.find((entry) => variants.has(keyOf(entry.name))) ??
    undefined
  )
}

export function findSinnohan(list: SinnohanForm[], slug: string): SinnohanForm | undefined {
  const variants = keyVariants(slug)
  return (
    list.find((form) => variants.has(form.slug)) ??
    list.find((form) => variants.has(keyOf(form.name)) || variants.has(keyOf(form.baseName))) ??
    undefined
  )
}
