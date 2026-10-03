/**
 * baseline.mjs — the vanilla **Platinum** baseline (PokeAPI) used to fill the
 * gaps the hack's documents leave open.
 *
 * Why this exists
 * ---------------
 * `PokemonChanges.txt` / `SinnohanForms.txt` record *changes* only. They never
 * enumerate a Pokémon's full TM/HM or move-tutor list, and 264 of the 493
 * entries carry no base stats at all. Everything a visitor expects to see and
 * the documents cannot provide is taken from the vanilla Platinum baseline and
 * labelled as such (`learnset.includesBaseline`, `baseStatsSource: "baseline"`,
 * `meta.enrichment`).
 *
 * Source: `https://pokeapi.co/api/v2/pokemon/<dex>`, filtered to
 * `version_group.name === "platinum"`. PokeAPI is structured and offline
 * cacheable, unlike a Poképedia page which mixes every generation's CT list.
 *
 * Cache layout — `.cache/pokeapi/` (git-ignored)
 * ---------------------------------------------
 *   <dex>.json         verbatim `/pokemon/<dex>` response   (493 files, ~140 MB)
 *   item-tm41.json     verbatim `/item/tm41` response        (100 files)
 *   machine-890.json   verbatim `/machine/890` response      (100 files)
 *   move-<slug>.json   verbatim `/move/<slug>` response      (English names)
 *   form-<slug>.json   verbatim `/pokemon-form/<slug>` response (26 files)
 *   derived.json       small projection of the above, read by `build-data.mjs`
 *   manifest.json      cache version, source, `fetchedAt`, counts
 *
 * Form variants
 * -------------
 * `/pokemon/<dex>` only carries the species' *default* typing, so the alternate
 * forms (Rotom's five appliances, Deoxys' formes, Wormadam's cloaks, …) have no
 * types anywhere in the cached responses. `FORM_VARIANTS` lists the eight
 * species whose alternate forms the codex shows; their `/pokemon-form/<slug>`
 * responses supply both the English form name and its `types[]` (`Heat Rotom`
 * => Electric / Fire). `build-data.mjs` needs those types to fill
 * `FormVariant.types` — see `docs/DATA-SCHEMA.md`, rev 3.
 *
 * `fetch-baseline.mjs` is the only thing that needs the network: once the raw
 * files are present it re-derives `derived.json` fully offline, and
 * `build-data.mjs` never fetches anything (it reads `derived.json` and falls
 * back to re-projecting the raw files when only those are present).
 *
 * TM numbers
 * ----------
 * `/pokemon/<dex>` says *which machine* a move is taught by but PokeAPI removed
 * the machine id from `version_group_details`, and the move resource carries no
 * TM number either. The vanilla TM/HM -> move table is therefore rebuilt from
 * `/item/tm01` … `/item/hm08`: each item lists its `machines[]` with the version
 * group, so the platinum machine yields both the slot (`tm41`) and its vanilla
 * move (`torment`). Slots missing from the hack's own `ItemChanges.txt` table
 * keep that vanilla move name; otherwise the hack's name for the slot wins.
 */

import fs from 'node:fs'
import path from 'node:path'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

/** Human-readable source label recorded in `meta.enrichment.source`. */
export const BASELINE_SOURCE = 'PokeAPI (version group: platinum)'

/** URL template recorded in `meta.enrichment.url`. */
export const BASELINE_URL = 'https://pokeapi.co/api/v2/pokemon/{dex}'

/**
 * Bumped whenever the projection in `derived.json` changes shape.
 *
 *  - 1: stats/types/levelUp/machine/tutor per dex, TM table, move names.
 *  - 2: adds `pokemon[].currentTypes` and `forms` (alternate-form types), rev 3.
 */
export const BASELINE_CACHE_VERSION = 2

/** `PokemonChanges.txt` covers dex 1..493 (Gen I–IV). */
export const POKEMON_MAX_DEX = 493

/** PokeAPI spells the level-up method `level-up`, not `levelup`. */
export const LEARN_METHODS = { levelUp: 'level-up', machine: 'machine', tutor: 'tutor' }

const PLATINUM = 'platinum'
const CONCURRENCY = 6
const RETRIES = 2
const TIMEOUT_MS = 20_000

/** The 92 TMs + 8 HMs of Platinum; their PokeAPI item names. */
export const TM_HM_ITEMS = [
  ...Array.from({ length: 92 }, (_, i) => `tm${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `hm${String(i + 1).padStart(2, '0')}`),
]

/* ------------------------------------------------------------------ */
/* Alternate forms                                                     */
/* ------------------------------------------------------------------ */

/**
 * The Pokémon whose alternate forms the codex lists, with the PokeAPI
 * `pokemon-form` slugs to cache for each.
 *
 * Why a fixed table instead of everything PokeAPI exposes: the documents only
 * document changes *per species*, and the forms worth listing are the ones with
 * their own typing (Rotom's appliances, Deoxys' formes, Wormadam's cloaks,
 * Shaymin, Giratina, Burmy, Castform, Cherrim). Purely cosmetic varieties
 * (Unown's 28 letters, Shellos/Gastrodon East & West Sea, Mothim's cloaks,
 * Spiky-eared Pichu) share the species' typing and would only add noise to the
 * forms list, so they are deliberately left out; Arceus's 18 plate forms are
 * plate-driven and already covered by the documented plate locations.
 *
 * `default` is the species' own base form: its typing is the species' typing
 * (`PokemonChange.baseTypes`), never an alternate form.
 */
export const FORM_VARIANTS = [
  { dex: 351, default: 'castform', forms: ['castform', 'castform-sunny', 'castform-rainy', 'castform-snowy'] },
  { dex: 386, default: 'deoxys-normal', forms: ['deoxys-normal', 'deoxys-attack', 'deoxys-defense', 'deoxys-speed'] },
  { dex: 412, default: 'burmy-plant', forms: ['burmy-plant', 'burmy-sandy', 'burmy-trash'] },
  { dex: 413, default: 'wormadam-plant', forms: ['wormadam-plant', 'wormadam-sandy', 'wormadam-trash'] },
  { dex: 421, default: 'cherrim-overcast', forms: ['cherrim-overcast', 'cherrim-sunshine'] },
  { dex: 479, default: 'rotom', forms: ['rotom', 'rotom-heat', 'rotom-wash', 'rotom-frost', 'rotom-fan', 'rotom-mow'] },
  { dex: 487, default: 'giratina-altered', forms: ['giratina-altered', 'giratina-origin'] },
  { dex: 492, default: 'shaymin-land', forms: ['shaymin-land', 'shaymin-sky'] },
]

/** Every `pokemon-form` slug the cache must hold, in table order. */
export const FORM_SLUGS = FORM_VARIANTS.flatMap((entry) => entry.forms)

/** `/pokemon-form/<slug>` — types + English display name of one alternate form. */
export const formUrl = (slug) => `${POKEAPI_BASE}/pokemon-form/${slug}`

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

const TYPE_LABELS = {
  normal: 'Normal', fighting: 'Fighting', flying: 'Flying', poison: 'Poison',
  ground: 'Ground', rock: 'Rock', bug: 'Bug', ghost: 'Ghost', steel: 'Steel',
  fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric',
  psychic: 'Psychic', ice: 'Ice', dragon: 'Dragon', dark: 'Dark',
  fairy: 'Fairy', unknown: '???', shadow: '???',
}

/** PokeAPI type slug -> the `PType` spelling the documents use. */
export function typeName(slug) {
  return TYPE_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

/**
 * Last-resort English name for a move slug. Only used when PokeAPI's own
 * English name is not in the cache — the pipeline always prefers the real one,
 * then the spelling used by the hack's documents.
 */
export function titleCaseSlug(slug) {
  return String(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const cacheRoot = (root) => path.join(root, '.cache', 'pokeapi')

/** Small projection of the raw cache, read by the build. */
export const derivedPath = (dir) => path.join(dir, 'derived.json')

/** Cache metadata (version, source, `fetchedAt`, counts). */
export const manifestPath = (dir) => path.join(dir, 'manifest.json')

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Read the cache manifest, or `null` when it has not been written yet. */
export const readManifest = (dir) => readJsonFile(manifestPath(dir))

/* ------------------------------------------------------------------ */
/* HTTP + concurrency                                                  */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** GET a JSON document with 2 retries and a 20 s per-attempt timeout. */
export async function fetchJson(url, { retries = RETRIES, timeoutMs = TIMEOUT_MS } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(500 * (attempt + 1) ** 2)
    }
  }
  throw new Error(`${url} — ${retries + 1} attempts failed: ${lastError?.message ?? 'unknown error'}`)
}

/** Run `worker` over `items` with at most `limit` jobs in flight. */
export async function pool(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

function cacheFile(dir, kind, key) {
  return path.join(dir, kind === 'pokemon' ? `${key}.json` : `${kind}-${key}.json`)
}

export function readCache(dir, kind, key) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(dir, kind, key), 'utf8'))
  } catch {
    return null
  }
}

export function hasCache(dir, kind, key) {
  return fs.existsSync(cacheFile(dir, kind, key))
}

function writeCache(dir, kind, key, value) {
  fs.writeFileSync(cacheFile(dir, kind, key), `${JSON.stringify(value)}\n`, 'utf8')
}

/** Read from the cache, otherwise fetch once and cache the verbatim response. */
async function cachedFetchJson(dir, kind, key, url) {
  const hit = readCache(dir, kind, key)
  if (hit) return { json: hit, cached: true }
  const json = await fetchJson(url)
  writeCache(dir, kind, key, json)
  return { json, cached: false }
}

/* ------------------------------------------------------------------ */
/* Projection of a `/pokemon/<dex>` response                           */
/* ------------------------------------------------------------------ */

function genNumber(name) {
  const roman = String(name ?? '').replace(/^generation-/, '')
  return ROMAN[roman] ?? 0
}

/**
 * The Pokémon's **Generation IV** typing.
 *
 * PokeAPI's `types[]` is the *current* typing, so Fairy-era retcons would leak
 * in (Togetic reads Fairy/Flying today but was Normal/Flying in Platinum).
 * `past_types[]` lists the earlier typings with the last generation they were
 * current in, so the set that was valid in Gen IV is the past entry with the
 * smallest generation >= 4 — e.g. Gardevoir's `generation-v: psychic`. A type
 * change that predates Gen IV (Magnemite's `generation-i: electric`) is ignored
 * because the current typing already applies in Gen IV.
 */
export function genFourTypes(raw) {
  const current = [...(raw.types ?? [])]
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map((entry) => typeName(entry.type?.name ?? ''))

  const past = (raw.past_types ?? [])
    .map((entry) => ({
      gen: genNumber(entry.generation?.name),
      types: [...(entry.types ?? [])]
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
        .map((t) => typeName(t.type?.name ?? '')),
    }))
    .filter((entry) => entry.gen >= 4 && entry.types.length > 0)
    .sort((a, b) => a.gen - b.gen)

  return past.length ? past[0].types : current
}

/**
 * PokeAPI's **current** typing, i.e. the latest generation's values.
 *
 * Recorded next to the Gen-IV typing so the type cross-check can tell the two
 * ways a document can disagree with vanilla Platinum apart: an *older* typing
 * (a pre-Gen-IV retcon, e.g. Magnemite's `Electric`) versus a *newer* one (the
 * Gen-VI Fairy retcon — `Granbull` is `Normal` in Platinum and `Fairy` today,
 * which is exactly what `TypeChanges.txt` writes as its `Old` type).
 */
export function currentTypes(raw) {
  return [...(raw.types ?? [])]
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map((entry) => typeName(entry.type?.name ?? ''))
}

/**
 * Projection of one `/pokemon-form/<slug>` response:
 * the form's English display name (`Heat Rotom`) and its types.
 *
 * `pokemon-form` has no `past_types`, which is correct here: the alternate forms
 * the codex lists kept their typing across every generation. Rotom's appliances
 * are the documented exception — the hack *wants* their Gen-V typing
 * (`TypeChanges.txt`: "Rotom's five alternate forms take the secondary type that
 * they have in the Gen V games"), which is what PokeAPI reports.
 */
export function extractForm(raw) {
  return {
    name: (raw.names ?? []).find((n) => n.language?.name === 'en')?.name ?? null,
    types: genFourTypes(raw),
  }
}


const STAT_KEYS = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
}

/** `stats[]` -> `StatBlock` (with the derived `bst`). */
export function statBlockFrom(raw) {
  const block = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, bst: 0 }
  for (const entry of raw.stats ?? []) {
    const key = STAT_KEYS[entry.stat?.name]
    if (key) block[key] = Number(entry.base_stat) || 0
  }
  block.bst = block.hp + block.atk + block.def + block.spa + block.spd + block.spe
  return block
}

/** Platinum-only learn data of one `/pokemon/<dex>` response. */
export function extractBaseline(raw) {
  const levelUp = []
  const machine = []
  const tutor = []

  for (const entry of raw.moves ?? []) {
    const slug = entry.move?.name
    if (!slug) continue
    for (const detail of entry.version_group_details ?? []) {
      if (detail.version_group?.name !== PLATINUM) continue
      const method = detail.move_learn_method?.name
      if (method === LEARN_METHODS.levelUp) {
        levelUp.push({ level: Number(detail.level_learned_at) || 0, slug })
      } else if (method === LEARN_METHODS.machine && !machine.includes(slug)) {
        machine.push(slug)
      } else if (method === LEARN_METHODS.tutor && !tutor.includes(slug)) {
        tutor.push(slug)
      }
    }
  }

  levelUp.sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug, 'en'))
  const deduped = []
  for (const entry of levelUp) {
    if (deduped.some((e) => e.level === entry.level && e.slug === entry.slug)) continue
    deduped.push(entry)
  }

  return {
    stats: statBlockFrom(raw),
    types: genFourTypes(raw),
    currentTypes: currentTypes(raw),
    levelUp: deduped,
    machine,
    tutor,
  }
}

/** Every move slug the pool of cached responses mentions on Platinum. */
function slugsOf(extracted) {
  const out = new Set()
  for (const entry of extracted.levelUp) out.add(entry.slug)
  for (const slug of extracted.machine) out.add(slug)
  for (const slug of extracted.tutor) out.add(slug)
  return out
}

/* ------------------------------------------------------------------ */
/* TM/HM table                                                         */
/* ------------------------------------------------------------------ */

/** `tm41` -> `TM41`, `hm01` -> `HM01` — the spelling `ItemChanges.txt` uses. */
const slotLabel = (item) => item.toUpperCase()

/**
 * Vanilla Platinum `TM/HM slot -> move` table, rebuilt from the 100 item
 * resources. Each `item.machines[]` entry names its version group, so the
 * platinum machine gives both the slot and the move it taught in Platinum.
 */
async function deriveTmTable(dir, tally) {
  const slots = {}
  const slugToSlot = {}
  const missing = []

  await pool(TM_HM_ITEMS, CONCURRENCY, async (item) => {
    const url = `${POKEAPI_BASE}/item/${item}`
    const label = slotLabel(item)
    try {
      const { json: itemJson, cached } = await cachedFetchJson(dir, 'item', item, url)
      if (!cached) tally.fetched++
      else tally.cached++

      const platinum = (itemJson.machines ?? []).find((m) => m.version_group?.name === PLATINUM)
      const id = platinum?.machine?.url?.match(/\/(\d+)\/?$/)?.[1]
      if (!id) {
        missing.push(label)
        return
      }
      const machineUrl = platinum.machine.url.startsWith('http')
        ? platinum.machine.url
        : `${POKEAPI_BASE}/machine/${id}`
      const { json: machine, cached: machineCached } = await cachedFetchJson(dir, 'machine', id, machineUrl)
      if (!machineCached) tally.fetched++
      else tally.cached++

      const slug = machine?.move?.name
      if (!slug || machine.version_group?.name !== PLATINUM) {
        missing.push(label)
        return
      }
      slots[label] = { slug, machine: Number(machine.id ?? id) }
      slugToSlot[slug] = label
    } catch (error) {
      tally.failed.push(`${url} — ${error.message}`)
      missing.push(label)
    }
  })

  return { slots, slugToSlot, missing: missing.sort() }
}

/**
 * English names for every move the baseline mentions. PokeAPI's slug is not the
 * English name (`high-jump-kick` is "High Jump Kick", `u-turn` is "U-turn"), so
 * the name is read from `move.names[language=en]`.
 */
async function deriveMoveNames(dir, slugs, tally) {
  const names = {}
  const unresolved = []

  await pool(slugs, CONCURRENCY, async (slug) => {
    const url = `${POKEAPI_BASE}/move/${slug}`
    try {
      const { json, cached } = await cachedFetchJson(dir, 'move', slug, url)
      if (!cached) tally.fetched++
      else tally.cached++
      const english = (json.names ?? []).find((n) => n.language?.name === 'en')?.name
      if (english) names[slug] = english
      else unresolved.push(slug)
    } catch (error) {
      tally.failed.push(`${url} — ${error.message}`)
      unresolved.push(slug)
    }
  })

  return { names, unresolved: unresolved.sort() }
}

/**
 * Fetch the `/pokemon-form/<slug>` responses of `FORM_VARIANTS`.
 * These carry the alternate forms' typing and English names, which no other
 * cached resource holds.
 */
async function fetchForms(dir, tally) {
  const failed = []

  await pool(FORM_SLUGS, CONCURRENCY, async (slug) => {
    const url = formUrl(slug)
    try {
      const { cached } = await cachedFetchJson(dir, 'form', slug, url)
      if (!cached) tally.fetched++
      else tally.cached++
    } catch (error) {
      tally.failed.push(`${url} — ${error.message}`)
      failed.push(slug)
    }
  })

  return { failed: failed.sort() }
}

/* ------------------------------------------------------------------ */
/* Projection: raw cache -> derived.json                               */
/* ------------------------------------------------------------------ */

/**
 * Re-project the raw cache into `derived.json`. Needs no network: it is also
 * what makes `build-data.mjs` fast (1 MB read instead of 140 MB of raw JSON)
 * and keeps both scripts reading exactly the same values.
 */
export function buildDerived(dir, tally = { fetched: 0, cached: 0, failed: [] }) {
  const pokemon = {}
  const slugs = new Set()
  const missingPokemon = []
  const missingForms = []

  for (let dex = 1; dex <= POKEMON_MAX_DEX; dex++) {
    const raw = readCache(dir, 'pokemon', dex)
    if (!raw) {
      missingPokemon.push(dex)
      continue
    }
    const extracted = extractBaseline(raw)
    pokemon[String(dex)] = extracted
    for (const slug of slugsOf(extracted)) slugs.add(slug)
  }

  const tmTable = deriveTmTableSync(dir)
  for (const slug of Object.keys(tmTable.slugToSlot)) slugs.add(slug)
  const moves = deriveMoveNamesSync(dir, [...slugs].sort())

  /* Alternate-form typings + English form names, in `FORM_VARIANTS` order. */
  const forms = {}
  for (const entry of FORM_VARIANTS) {
    const list = []
    for (const slug of entry.forms) {
      const raw = readCache(dir, 'form', slug)
      if (!raw) {
        missingForms.push(slug)
        continue
      }
      const extracted = extractForm(raw)
      list.push({
        slug,
        name: extracted.name,
        types: extracted.types,
        isDefault: slug === entry.default,
      })
    }
    if (list.length) forms[String(entry.dex)] = list
  }

  return {
    derived: {
      cacheVersion: BASELINE_CACHE_VERSION,
      source: BASELINE_SOURCE,
      url: BASELINE_URL,
      versionGroup: PLATINUM,
      learnMethods: LEARN_METHODS,
      tmTable: { slots: tmTable.slots, slugToSlot: tmTable.slugToSlot, missing: tmTable.missing },
      moveNames: moves.names,
      unresolvedMoveNames: moves.unresolved,
      pokemon,
      forms,
    },
    missingPokemon,
    missingForms,
    missingMoveNames: moves.unresolved,
  }
}

/** Synchronous half of `deriveTmTable` — reads the caches the fetcher wrote. */
function deriveTmTableSync(dir) {
  const slots = {}
  const slugToSlot = {}
  const missing = []
  for (const item of TM_HM_ITEMS) {
    const label = slotLabel(item)
    const itemJson = readCache(dir, 'item', item)
    const platinum = (itemJson?.machines ?? []).find((m) => m.version_group?.name === PLATINUM)
    const id = platinum?.machine?.url?.match(/\/(\d+)\/?$/)?.[1]
    const machine = id ? readCache(dir, 'machine', id) : null
    const slug = machine?.move?.name
    if (!slug || machine.version_group?.name !== PLATINUM) {
      missing.push(label)
      continue
    }
    slots[label] = { slug, machine: Number(machine.id ?? id) }
    slugToSlot[slug] = label
  }
  return { slots, slugToSlot, missing: missing.sort() }
}

function deriveMoveNamesSync(dir, slugs) {
  const names = {}
  const unresolved = []
  for (const slug of slugs) {
    const json = readCache(dir, 'move', slug)
    const english = (json?.names ?? []).find((n) => n.language?.name === 'en')?.name
    if (english) names[slug] = english
    else unresolved.push(slug)
  }
  return { names, unresolved }
}

/* ------------------------------------------------------------------ */
/* Fetch entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch every missing response, then refresh `derived.json` + `manifest.json`.
 * Fully offline once the raw cache is warm.
 */
export async function fetchBaseline({ root, force = false, onProgress = () => {} } = {}) {
  const dir = cacheRoot(root)
  fs.mkdirSync(dir, { recursive: true })

  const tally = { fetched: 0, cached: 0, failed: [] }

  // 1. the 493 Pokémon.
  const dexes = Array.from({ length: POKEMON_MAX_DEX }, (_, i) => i + 1)
  let done = 0
  await pool(dexes, CONCURRENCY, async (dex) => {
    const url = `${POKEAPI_BASE}/pokemon/${dex}`
    try {
      if (!force && hasCache(dir, 'pokemon', dex)) {
        tally.cached++
      } else {
        writeCache(dir, 'pokemon', dex, await fetchJson(url))
        tally.fetched++
      }
    } catch (error) {
      tally.failed.push(`${url} — ${error.message}`)
    } finally {
      onProgress(++done, dexes.length, 'pokemon')
    }
  })

  // 2. the vanilla TM/HM table + 3. English move names + 4. form typings.
  const missingPokemon = dexes.filter((dex) => !hasCache(dir, 'pokemon', dex))
  const tmTable = await deriveTmTable(dir, tally)
  const slugs = new Set(Object.keys(tmTable.slugToSlot))
  for (const dex of dexes) {
    const raw = readCache(dir, 'pokemon', dex)
    if (raw) for (const slug of slugsOf(extractBaseline(raw))) slugs.add(slug)
  }
  const moveNames = await deriveMoveNames(dir, [...slugs].sort(), tally)
  const formTally = await fetchForms(dir, tally)

  // 5. projection + manifest (offline, idempotent).
  const { derived, missingForms } = buildDerived(dir, tally)
  fs.writeFileSync(derivedPath(dir), `${JSON.stringify(derived)}\n`, 'utf8')

  const previous = readJsonFile(manifestPath(dir))
  const fetchedAt =
    tally.fetched > 0 || !previous?.fetchedAt ? new Date().toISOString() : previous.fetchedAt
  const manifest = {
    cacheVersion: BASELINE_CACHE_VERSION,
    source: BASELINE_SOURCE,
    url: BASELINE_URL,
    versionGroup: PLATINUM,
    fetchedAt,
    counts: {
      pokemon: dexes.length - missingPokemon.length,
      tmSlots: Object.keys(tmTable.slots).length,
      moveNames: Object.keys(moveNames.names).length,
      forms: FORM_SLUGS.length - missingForms.length,
    },
  }
  fs.writeFileSync(manifestPath(dir), `${JSON.stringify(manifest)}\n`, 'utf8')

  return {
    dir,
    fetchedAt,
    tally: {
      ...tally,
      missingPokemon,
      tmSlots: Object.keys(tmTable.slots).length,
      tmMissing: tmTable.missing,
      moveNames: Object.keys(moveNames.names).length,
      moveNamesUnresolved: moveNames.unresolved,
      formSlugs: FORM_SLUGS.length,
      formsMissing: missingForms,
      formsFailed: formTally.failed,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Loader used by `build-data.mjs`                                     */
/* ------------------------------------------------------------------ */

/** Max mtime of the cache directory — the deterministic `fetchedAt` fallback. */
function newestMtime(dir) {
  let newest = 0
  for (const name of fs.readdirSync(dir)) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(dir, name)).mtimeMs)
    } catch {
      /* ignore unreadable entries */
    }
  }
  return newest || Date.now()
}

/**
 * Load the baseline for the build. Never touches the network.
 *
 * Prefers the small `derived.json` projection; falls back to projecting the raw
 * responses when only those are present. Throws a actionable error when the
 * cache is cold, because a build without the baseline cannot satisfy the data
 * contract (every entry must carry `baseStats`).
 */
export function loadBaseline(root, log = { warn() {} }) {
  const dir = cacheRoot(root)
  if (!fs.existsSync(dir)) {
    throw new Error(
      'vanilla Platinum baseline is not cached: .cache/pokeapi is missing.\n' +
        '  Run `node scripts/fetch-baseline.mjs` once (it needs network) — after that\n' +
        '  both the fetcher and `node scripts/build-data.mjs` work completely offline.',
    )
  }

  let derived = readJsonFile(derivedPath(dir))
  if (!derived || derived.cacheVersion !== BASELINE_CACHE_VERSION) {
    const { derived: rebuilt, missingPokemon } = buildDerived(dir)
    if (missingPokemon.length) {
      throw new Error(
        `vanilla Platinum baseline incomplete: ${missingPokemon.length} of ${POKEMON_MAX_DEX} ` +
          `pokemon responses are missing from .cache/pokeapi (first: ${missingPokemon.slice(0, 5).join(', ')}).\n` +
          '  Run `node scripts/fetch-baseline.mjs` to complete the cache.',
      )
    }
    log.warn?.('baseline: .cache/pokeapi/derived.json missing or stale — rebuilt from the raw responses')
    derived = rebuilt
  }

  const manifest = readJsonFile(manifestPath(dir))
  const byDex = new Map()
  for (const [dex, entry] of Object.entries(derived.pokemon)) byDex.set(Number(dex), entry)

  /*
   * The TM/HM slot table comes from the 100 cached item/machine responses. When
   * it is empty the baseline machine lists cannot be turned into numbered TMs, so
   * fail loudly instead of silently emitting empty TM lists.
   */
  if (!derived.tmTable || Object.keys(derived.tmTable.slots ?? {}).length === 0) {
    throw new Error(
      'the vanilla TM/HM table is missing from .cache/pokeapi (item-*.json / machine-*.json).\n' +
        '  Run `node scripts/fetch-baseline.mjs` to (re)build it.',
    )
  }

  /* Alternate-form typings, keyed by dex, in `FORM_VARIANTS` order. */
  const formsByDex = new Map()
  const presentForms = new Set()
  for (const [dex, list] of Object.entries(derived.forms ?? {})) {
    formsByDex.set(Number(dex), list)
    for (const form of list) presentForms.add(form.slug)
  }
  /*
   * `FormVariant.types` is a required part of rev 3: a build without the
   * `pokemon-form` responses would emit form entries with no typing at all —
   * exactly the hole being fixed. Fail loudly instead, like the TM table above.
   */
  const missingForms = FORM_SLUGS.filter((slug) => !presentForms.has(slug))
  if (missingForms.length) {
    throw new Error(
      `alternate-form typings are missing from .cache/pokeapi: ${missingForms.length} of ${FORM_SLUGS.length} ` +
        `pokemon-form response(s) (first: ${missingForms.slice(0, 5).join(', ')}).\n` +
        '  Run `node scripts/fetch-baseline.mjs` to fetch them (form-<slug>.json).',
    )
  }

  const moveNames = derived.moveNames ?? {}
  const nameCache = new Map()
  /** English display name for a move slug (PokeAPI name, else a title-cased slug). */
  const moveName = (slug) => {
    if (nameCache.has(slug)) return nameCache.get(slug)
    const name = moveNames[slug] ?? titleCaseSlug(slug)
    nameCache.set(slug, name)
    return name
  }

  return {
    available: true,
    dir,
    source: derived.source ?? BASELINE_SOURCE,
    url: derived.url ?? BASELINE_URL,
    versionGroup: derived.versionGroup ?? PLATINUM,
    fetchedAt: manifest?.fetchedAt ?? new Date(newestMtime(dir)).toISOString(),
    byDex,
    tmTable: derived.tmTable ?? { slots: {}, slugToSlot: {}, missing: [] },
    moveNames,
    unresolvedMoveNames: derived.unresolvedMoveNames ?? [],
    moveName,
    formsByDex,
    /** Convenience: the vanilla entry of a dex number. */
    at(dex) {
      return byDex.get(Number(dex)) ?? null
    },
    /**
     * The species' alternate forms (default form included, flagged `isDefault`),
     * each `{ slug, name, types, isDefault }`. Empty for the 485 species that
     * have no alternate form worth listing.
     */
    formsAt(dex) {
      return formsByDex.get(Number(dex)) ?? []
    },
  }
}
