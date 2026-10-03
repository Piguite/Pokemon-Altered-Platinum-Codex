#!/usr/bin/env node
/**
 * build-data.mjs — Altered Platinum codex data pipeline.
 *
 * Reads every document in `data/source/`, parses it into the frozen shapes
 * declared in `src/types/data.ts` (see `docs/DATA-SCHEMA.md`) and writes the
 * JSON bundle consumed by the app into `public/data/`.
 *
 * Run with:  node scripts/build-data.mjs
 *
 * Guarantees
 *  - no dependencies (Node 22 ESM built-ins only),
 *  - works completely offline,
 *  - deterministic: stable key order and array order, so two consecutive runs
 *    produce byte-identical files,
 *  - never silently drops source content: anything that cannot be mapped to a
 *    typed field is kept in a `RawSection` / `noteSections` and counted in the
 *    unparsed-line report printed at the end.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { BuildLog, bodyLines, readLines, splitRuleSections, statSum, collapse } from './lib/text.mjs'
import { parsePokemonChanges, parseSinnohanForms } from './lib/pokemon.mjs'
import { parseTypeChanges } from './lib/types.mjs'
import { parseMoveChanges } from './lib/moves.mjs'
import { parseItemChanges } from './lib/items.mjs'
import { parseEvolutionChanges } from './lib/evolutions.mjs'
import { parseTrainerPokemon } from './lib/trainers.mjs'
import { parseWildPokemon } from './lib/wild.mjs'
import { parseSpecialEvents } from './lib/events.mjs'
import { parseActionReplay, parseFaq, parseLevelCaps, parseNpcChanges, parseTradeChanges } from './lib/misc.mjs'
import { buildSearchIndex } from './lib/search.mjs'
import { loadBaseline } from './lib/baseline.mjs'
import {
  POKEMON_TYPES,
  crossCheckTypes,
  enrichAll,
  isValidTypeList,
  matchesDefaultForm,
  parseCompatNotes,
  sameTypeList,
} from './lib/enrich.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SOURCE_DIR = path.join(ROOT, 'data', 'source')
const OUT_DIR = path.join(ROOT, 'public', 'data')
const SPRITE_DIR = path.join(ROOT, 'public', 'sprites')

const HACK = 'Pokémon Altered Platinum'
const AUTHOR = 'Drayano'

/**
 * Per-document metadata. `route` mirrors the hash routes the app serves.
 * `Changelog.txt` is listed in `docs/DATA-SCHEMA.md` but is *not* present in
 * `data/source/`, so `changelog.json` is emitted as an empty array.
 */
const DOCUMENTS = [
  {
    id: 'pokemon-changes',
    title: 'Pokémon Changes',
    file: 'PokemonChanges.txt',
    route: '#/pokemon',
    summary: 'Per-Pokémon type, base stat, ability, held item, evolution and learnset changes.',
  },
  {
    id: 'sinnohan-forms',
    title: 'Sinnohan Forms',
    file: 'SinnohanForms.txt',
    route: '#/sinnohan',
    summary: 'The 65 Sinnohan regional forms: types, abilities, stats, evolutions and learnsets.',
  },
  {
    id: 'type-changes',
    title: 'Type Changes',
    file: 'TypeChanges.txt',
    route: '#/types',
    summary: 'The Ice type-chart rework and the 69 Pokémon type changes with justifications.',
  },
  {
    id: 'move-changes',
    title: 'Move Changes',
    file: 'MoveChanges.txt',
    route: '#/moves',
    summary: 'Move replacements, the ten new moves, and numeric move modifications.',
  },
  {
    id: 'item-changes',
    title: 'Item Changes',
    file: 'ItemChanges.txt',
    route: '#/items',
    summary: 'Modified items, costs, TM moves, mart stock, and item/TM/plate locations.',
  },
  {
    id: 'evolution-changes',
    title: 'Evolution Changes',
    file: 'EvolutionChanges.txt',
    route: '#/evolutions',
    summary: 'Item-interaction, level and method evolution changes.',
  },
  {
    id: 'trainer-pokemon',
    title: 'Trainer Pokémon',
    file: 'TrainerPokemon.txt',
    route: '#/trainers',
    summary: 'Trainer rosters by area plus detailed boss teams with items, abilities and moves.',
  },
  {
    id: 'wild-pokemon',
    title: 'Wild Pokémon',
    file: 'WildPokemon.txt',
    route: '#/wild',
    summary: 'Wild encounters by area, method and time of day.',
  },
  {
    id: 'special-events',
    title: 'Special Events',
    file: 'SpecialEvents.txt',
    route: '#/events',
    summary: 'Gift, static and legendary encounter events.',
  },
  {
    id: 'npc-changes',
    title: 'NPC Changes',
    file: 'NPCChanges.txt',
    route: '#/guides/npc',
    summary: 'New and relocated NPCs (evolution item seller, move tutors, berry seller, ...).',
  },
  {
    id: 'trade-changes',
    title: 'Trade Changes',
    file: 'TradeChanges.txt',
    route: '#/guides/trades',
    summary: 'The four in-game trades, their requested Pokémon, held items, IVs and natures.',
  },
  {
    id: 'level-caps',
    title: 'Level Caps',
    file: 'LevelCaps.txt',
    route: '#/guides/level-caps',
    summary: 'Recommended level caps for important trainers.',
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    file: 'FrequentlyAskedQuestions.txt',
    route: '#/guides/faq',
    summary: 'Patching, updating, shiny odds and progression answers.',
  },
  {
    id: 'action-replay',
    title: 'Action Replay Codes',
    file: 'ActionReplayCodes.txt',
    route: '#/guides/action-replay',
    summary: 'Optional Action Replay cheat codes for quality-of-life changes.',
  },
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Source file -> lines, registered with the log for line-number lookups. */
function loadSource(file, log) {
  const lines = readLines(path.join(SOURCE_DIR, file))
  log.registerFile(file, lines)
  return lines
}

/** Version banner, e.g. `| Type Changes (r1.0.5) |` -> `r1.0.5`. */
function bannerVersion(lines) {
  for (const line of lines.slice(0, 12)) {
    const m = collapse(line).match(/\(r([\d.]+\w*)\)/)
    if (m) return `r${m[1]}`
  }
  return undefined
}

/** ISO timestamp of the newest source file — deterministic across rebuilds. */
function sourceStamp(files) {
  let newest = 0
  for (const file of files) {
    const stat = fs.statSync(path.join(SOURCE_DIR, file))
    newest = Math.max(newest, stat.mtimeMs)
  }
  return new Date(newest).toISOString()
}

/**
 * Walk every `StatBlock` in the bundle so the build can verify the BST identity
 * and report source values that disagree with the sum of the six stats.
 */
function walkStatBlocks(pokemon, sinnohan) {
  const found = []
  const visit = (stat, where) => {
    if (stat && typeof stat.hp === 'number') found.push({ stat, where })
  }
  for (const p of pokemon) {
    visit(p.stats?.old, `${p.name} (old)`)
    visit(p.stats?.new, `${p.name} (new)`)
    visit(p.baseStats, `${p.name} (baseStats)`)
    for (const form of p.forms) {
      visit(form.stats?.old, `${p.name} ${form.form} (old)`)
      visit(form.stats?.new, `${p.name} ${form.form} (new)`)
    }
  }
  for (const f of sinnohan) {
    visit(f.stats, f.name)
    visit(f.replacedStats, `${f.name} (vanilla)`)
  }
  return found
}

/**
 * The sources contain 25 stat blocks whose `BST` does not equal the sum of the
 * six stats they list (e.g. Chikorita's new block claims 405 BST for stats that
 * add up to 318). `docs/DATA-SCHEMA.md` both calls the source BST authoritative
 * *and* requires `bst === hp + atk + def + spa + spd + spe`, which cannot hold
 * for those blocks. The six stats are the values the game actually uses, so the
 * derived total is recomputed here and every disagreement is reported as a
 * warning naming both numbers — nothing is hidden, and the raw source line
 * stays in the entry's `sections[]`.
 */
function normaliseBst(pokemon, sinnohan, log) {
  const visit = (stat, where) => {
    if (!stat || typeof stat.hp !== 'number') return
    const sum = statSum(stat)
    if (stat.bst === sum) return
    log.warn(
      `source BST disagrees with its six stats: ${where} lists BST ${stat.bst} but ${stat.hp}+${stat.atk}+${stat.def}+${stat.spa}+${stat.spd}+${stat.spe} = ${sum}; bst set to ${sum} (raw line kept in sections[])`,
    )
    stat.bst = sum
  }
  for (const p of pokemon) {
    visit(p.stats?.old, `${p.name} (old)`)
    visit(p.stats?.new, `${p.name} (new)`)
    for (const form of p.forms) {
      visit(form.stats?.old, `${p.name} ${form.form} (old)`)
      visit(form.stats?.new, `${p.name} ${form.form} (new)`)
    }
  }
  for (const f of sinnohan) visit(f.stats, f.name)
}

/** Count learning entries in a learnset. */
const learnCount = (learnset) => learnset.levelUp.length + learnset.tm.length + learnset.tutor.length

/** Serialise deterministically: 2-space-free compact JSON with a trailing newline. */
function writeJson(file, value) {
  const target = path.join(OUT_DIR, file)
  const json = `${JSON.stringify(value)}\n`
  fs.writeFileSync(target, json, 'utf8')
  return Buffer.byteLength(json, 'utf8')
}

const pad = (value, width) => String(value).padEnd(width)
const num = (value) => String(value).padStart(7)

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const log = new BuildLog()
  const files = DOCUMENTS.map((d) => d.file)

  /* ---- parse every document ------------------------------------- */

  const pcLines = loadSource('PokemonChanges.txt', log)
  const sinnohanLines = loadSource('SinnohanForms.txt', log)
  const typeLines = loadSource('TypeChanges.txt', log)
  const moveLines = loadSource('MoveChanges.txt', log)
  const itemLines = loadSource('ItemChanges.txt', log)
  const evoLines = loadSource('EvolutionChanges.txt', log)
  const trainerLines = loadSource('TrainerPokemon.txt', log)
  const wildLines = loadSource('WildPokemon.txt', log)
  const eventLines = loadSource('SpecialEvents.txt', log)
  const npcLines = loadSource('NPCChanges.txt', log)
  const tradeLines = loadSource('TradeChanges.txt', log)
  const levelCapLines = loadSource('LevelCaps.txt', log)
  const faqLines = loadSource('FrequentlyAskedQuestions.txt', log)
  const arLines = loadSource('ActionReplayCodes.txt', log)

  /* ---- vanilla Platinum baseline -------------------------------- */

  /*
   * The baseline is loaded *before* the documents are parsed, because the parser
   * needs one baseline fact: which form a species has **by default**
   * (`isDefault` — `wormadam-plant`, `deoxys-normal`, `shaymin-land`). A
   * document section scoped to that form (`Base Stats (Plant Cloak)`) describes
   * the species itself and must fill the entry's own fields instead of becoming
   * a pseudo-form variant; only the cached vanilla data knows which cloak/form
   * that is. See `speciesScopeReason` in `scripts/lib/pokemon.mjs`.
   */
  let baseline
  try {
    baseline = loadBaseline(ROOT, log)
  } catch (error) {
    // A cold baseline cache is the one failure a fresh clone hits; report it as
    // a one-line instruction rather than a stack trace.
    console.error('')
    console.error(`BUILD FAILED — ${error.message}`)
    console.error('')
    process.exit(1)
  }

  const pokemonDoc = parsePokemonChanges(pcLines, log, 'PokemonChanges.txt', {
    isDefaultFormScope: (dex, scope) => matchesDefaultForm(baseline.formsAt(dex), scope),
  })
  const sinnohanDoc = parseSinnohanForms(sinnohanLines, log, 'SinnohanForms.txt')
  const typeChanges = parseTypeChanges(typeLines, log, 'TypeChanges.txt')
  const moves = parseMoveChanges(moveLines, log, 'MoveChanges.txt')
  const items = parseItemChanges(itemLines, log, 'ItemChanges.txt')
  const evolutions = parseEvolutionChanges(evoLines)
  const trainers = parseTrainerPokemon(trainerLines, log, 'TrainerPokemon.txt')
  const wild = parseWildPokemon(wildLines, log, 'WildPokemon.txt')
  const events = parseSpecialEvents(eventLines, log, 'SpecialEvents.txt')
  const npc = parseNpcChanges(npcLines)
  const trade = parseTradeChanges(tradeLines, log, 'TradeChanges.txt')
  const levelCaps = parseLevelCaps(levelCapLines)
  const faq = parseFaq(faqLines)
  const actionReplay = parseActionReplay(arLines)

  const pokemon = pokemonDoc.entries
  const sinnohan = sinnohanDoc.entries

  // Recompute any BST that the source got wrong (reported as a warning each).
  normaliseBst(pokemon, sinnohan, log)

  /* ---- vanilla Platinum baseline enrichment ---------------------- */

  /*
   * The documents record *changes* only: 264 of the 493 entries carry no base
   * stats, no entry enumerates its TM/HM or move-tutor list, and 68 have no
   * level-up list. Everything they leave out comes from the cached vanilla
   * Platinum baseline (PokeAPI, version group `platinum`); documented values
   * always win. See `scripts/lib/enrich.mjs` and `docs/DATA-SCHEMA.md`.
   */
  const enrichment = enrichAll({ pokemon, sinnohan, baseline, items, moves, log })
  log.note(
    `baseline: ${baseline.source} cached at ${baseline.fetchedAt} — ` +
      `${enrichment.statsFilled} base stat block(s), ${enrichment.tmFilled} TM/HM list(s), ` +
      `${enrichment.tutorFilled} tutor list(s) and ${enrichment.levelUpFilled} level-up list(s) filled`,
  )
  log.note(
    `"Moves:" compatibility lines: ${enrichment.docTmEntries} TM/HM and ${enrichment.docTutorEntries} move-tutor ` +
      `compatibility(ies) parsed into learnsets; ${enrichment.compatNotesOnly} line(s) stay notes only ` +
      '(e.g. "Now compatible with all TMs and HMs.")',
  )
  if (enrichment.tmNoSlot > 0) {
    log.warn(
      `${enrichment.tmNoSlot} baseline machine move(s) have no TM/HM slot in the vanilla table — omitted from learnsets`,
    )
  }
  const strayCompat = pokemon.flatMap((p) => parseCompatNotes(p.moves).leftover).filter((n) => /compatible/i.test(n.text))
  if (strayCompat.length) {
    log.warn(`${strayCompat.length} unrecognised "compatible" line(s) kept as notes: ${strayCompat.slice(0, 3).map((n) => n.text).join(' | ')}`)
  }

  /* ---- cross-document notes ------------------------------------- */

  const capFor = (name) => levelCaps.find((c) => c.startsWith(`${name},`))
  const marsCaps = capFor('Mars')
  const marsTrainer = trainers.areas
    .flatMap((a) => [...a.trainers, ...a.rematches, ...a.bosses.map((b) => ({ name: b.name, team: b.team }))])
    .filter((t) => /^Commander Mars$/.test(t.name))
  if (marsCaps) {
    const capLevel = Number((marsCaps.match(/Lv\.\s*(\d+)/) ?? [])[1])
    const trainerLevels = [
      ...new Set(marsTrainer.flatMap((t) => t.team.map((s) => s.level))),
    ].sort((a, b) => a - b)
    log.note(
      `Sources disagree about Mars: LevelCaps.txt says "${marsCaps}" while TrainerPokemon.txt lists levels ${trainerLevels.join(', ')} for Commander Mars. ` +
        'Both values are reproduced verbatim; the pipeline does not reconcile them.',
    )
    if (capLevel && !trainerLevels.includes(capLevel)) {
      log.warn(`Mars level cap (${capLevel}) does not appear in any Commander Mars roster — left as-is`)
    }
  }

  /* ---- meta ------------------------------------------------------ */

  const entryCounts = {
    'pokemon-changes': pokemon.length,
    'sinnohan-forms': sinnohan.length,
    'type-changes': typeChanges.pokemonChanges.length,
    'move-changes': moves.replacements.length + moves.newMoves.length + moves.modifications.length + moves.groupModifications.length,
    'item-changes':
      items.usableItems.length +
      items.costChanges.length +
      items.tmChanges.length +
      items.itemLocations.length +
      items.tmLocations.length +
      items.plateLocations.length +
      items.vitaminReplacements.length +
      items.replacedItems.length,
    'evolution-changes': evolutions.sections.reduce((n, s) => n + s.entries.length, 0),
    'trainer-pokemon': trainers.areas.length,
    'wild-pokemon': wild.areas.length,
    'special-events': events.sections.reduce((n, s) => n + s.items.length, 0),
    'npc-changes': npc.length,
    'trade-changes': trade.trades.length,
    'level-caps': levelCaps.length,
    faq: faq.length,
    'action-replay': actionReplay.length,
  }

  const generalNotesFor = {
    'pokemon-changes': pokemonDoc.generalNotes,
    'sinnohan-forms': sinnohanDoc.generalNotes,
    'type-changes': [
      { title: 'General Changes', lines: typeChanges.generalNotes },
      { title: 'Ice Type Changes', lines: typeChanges.iceTypeNotes },
    ].filter((s) => s.lines.length),
    'move-changes': [{ title: 'General Changes', lines: moves.generalNotes }].filter((s) => s.lines.length),
    'item-changes': [],
    'evolution-changes': [],
    'trainer-pokemon': trainers.documentNotes,
    'wild-pokemon': [{ title: 'General Changes', lines: wild.generalNotes }].filter((s) => s.lines.length),
    'special-events': [{ title: 'General Notes', lines: events.generalNotes }].filter((s) => s.lines.length),
    'npc-changes': [],
    'trade-changes': [{ title: 'General Changes', lines: trade.tradeNotes }].filter((s) => s.lines.length),
    'level-caps': [],
    faq: [],
    'action-replay': [],
  }

  const linesByFile = {
    'PokemonChanges.txt': pcLines,
    'SinnohanForms.txt': sinnohanLines,
    'TypeChanges.txt': typeLines,
    'MoveChanges.txt': moveLines,
    'ItemChanges.txt': itemLines,
    'EvolutionChanges.txt': evoLines,
    'TrainerPokemon.txt': trainerLines,
    'WildPokemon.txt': wildLines,
    'SpecialEvents.txt': eventLines,
    'NPCChanges.txt': npcLines,
    'TradeChanges.txt': tradeLines,
    'LevelCaps.txt': levelCapLines,
    'FrequentlyAskedQuestions.txt': faqLines,
    'ActionReplayCodes.txt': arLines,
  }

  const documents = DOCUMENTS.map((doc) => {
    const version = bannerVersion(linesByFile[doc.file])
    return {
      id: doc.id,
      title: doc.title,
      file: doc.file,
      ...(version ? { version } : {}),
      summary: doc.summary,
      entryCount: entryCounts[doc.id],
      generalNotes: generalNotesFor[doc.id],
      route: doc.route,
    }
  })

  const meta = {
    hack: HACK,
    version: 'r1.0.5',
    originalAuthor: AUTHOR,
    // Derived from the newest source file so rebuilds stay byte-identical.
    generatedAt: sourceStamp(files),
    documents,
    /*
     * What the vanilla Platinum baseline contributed. `fetchedAt` comes from the
     * cache manifest (written by `scripts/fetch-baseline.mjs`), never from the
     * wall clock, so a rebuild produces byte-identical JSON.
     */
    enrichment: {
      source: baseline.source,
      url: baseline.url,
      fetchedAt: baseline.fetchedAt,
      statsFilled: enrichment.statsFilled,
      tmFilled: enrichment.tmFilled,
      tutorFilled: enrichment.tutorFilled,
      levelUpFilled: enrichment.levelUpFilled,
    },
    counts: {
      documents: documents.length,
      pokemon: pokemon.length,
      /*
       * Counted from `changeKinds`, not from the presence of a documented
       * `type` block, so the dashboard tile and the "Type" facet chip on
       * #/pokemon can never disagree. The two figures differ because a Sinnohan
       * form retypes the species it replaces without `TypeChanges.txt`
       * mentioning it: 69 rows are documented there and 65 Sinnohan forms also
       * retype — 134 in total. `typeChangeEntries` keeps the documented-rows
       * figure for the Types page.
       */
      pokemonWithTypeChange: pokemon.filter((p) => p.changeKinds.includes('type')).length,
      /*
       * Counted from `changeKinds` too, for the same reason as `type` above:
       * `#/pokemon`'s facet chips filter on `changeKinds`, and a Pokémon whose
       * stat or ability change lives only in a form variant carries the kind
       * without a top-level `stats`/`ability` block. Counting the blocks made
       * these two drift one behind the facets (231 vs 232, 314 vs 315).
       */
      pokemonWithStatChange: pokemon.filter((p) => p.changeKinds.includes('stats')).length,
      pokemonWithAbilityChange: pokemon.filter((p) => p.changeKinds.includes('ability')).length,
      sinnohan: sinnohan.length,
      typeChangeEntries: typeChanges.pokemonChanges.length,
      typeChartChanges: typeChanges.chartChanges.length,
      moveReplacements: moves.replacements.length,
      newMoves: moves.newMoves.length,
      /** Single-move and grouped records combined — the count the Moves page shows. */
      moveModifications: moves.modifications.length + moves.groupModifications.length,
      costChanges: items.costChanges.length,
      trainerAreas: trainers.areas.length,
      trainers: trainers.areas.reduce((n, a) => n + a.trainers.length + a.rematches.length, 0),
      wildAreas: wild.areas.length,
      events: events.sections.reduce((n, s) => n + s.items.length, 0),
      trades: trade.trades.length,
      faq: faq.length,
    },
  }

  /* ---- assemble + write ------------------------------------------ */

  // `TrainersDoc` wants a flat `string[]`; `documentNotes` keeps the grouped
  // form for `meta.json`.
  const trainersDoc = {
    generalNotes: trainers.generalNotes,
    levelCaps: trainers.levelCaps,
    areas: trainers.areas,
  }

  const bundle = {
    meta,
    pokemon,
    sinnohan,
    typeChanges,
    moves,
    items,
    evolutions,
    trainers: trainersDoc,
    wild,
    events,
    misc: {
      npc,
      trades: trade.trades,
      tradeNotes: trade.tradeNotes,
      levelCaps,
      faq,
      actionReplay,
    },
    changelog: [],
  }

  const searchIndex = buildSearchIndex({ ...bundle, documents })

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const outputs = [
    ['meta.json', bundle.meta],
    ['pokemon.json', bundle.pokemon],
    ['sinnohan.json', bundle.sinnohan],
    ['type-changes.json', bundle.typeChanges],
    ['moves.json', bundle.moves],
    ['items.json', bundle.items],
    ['evolutions.json', bundle.evolutions],
    ['trainers.json', bundle.trainers],
    ['wild.json', bundle.wild],
    ['events.json', bundle.events],
    ['misc.json', bundle.misc],
    ['changelog.json', bundle.changelog],
    ['search-index.json', searchIndex],
  ]

  const sizes = new Map()
  for (const [file, value] of outputs) sizes.set(file, writeJson(file, value))

  const recordCount = (value) => (Array.isArray(value) ? value.length : 1)

  /* ---- assertions ------------------------------------------------ */

  const statBlocks = walkStatBlocks(pokemon, sinnohan)
  const badBst = statBlocks.filter(({ stat }) => stat.bst !== statSum(stat))

  const uniqueDex = (list) => new Set(list.map((e) => e.dex)).size === list.length
  const uncovered = [...pokemonDoc.coverage, ...sinnohanDoc.coverage].filter((c) => c.covered < c.nonBlank)

  const checks = []
  const check = (name, ok, expected, actual, note) => checks.push({ name, ok, expected, actual, note })

  /*
   * `pokemon.length` is 493, not 497.
   *
   * `PokemonChanges.txt` holds exactly 493 entries (`rule / NNN - Name / rule`,
   * dex 1..493). A naive `^\d{3} - ` line scan reports 497 because Arceus's four
   * level-100 moves (`100 - Recover`, `100 - Judgment`, `100 - Spacial Rend`,
   * `100 - Shadow Force`) look exactly like entry headers. Entry headers are
   * therefore anchored to the surrounding rules, never to the line shape alone —
   * see `splitRuleSections` in `scripts/lib/text.mjs`, which only opens a new
   * entry on a `rule / title / rule` triple.
   */
  const CONTRACT_COUNTS = {
    'pokemon.length': [493, pokemon.length],
    'sinnohan.length': [65, sinnohan.length],
    'typeChanges.pokemonChanges.length': [69, typeChanges.pokemonChanges.length],
    'typeChanges.chartChanges.length': [4, typeChanges.chartChanges.length],
    'moves.replacements.length': [29, moves.replacements.length],
    'moves.newMoves.length': [10, moves.newMoves.length],
  }

  for (const [name, [expected, actual]] of Object.entries(CONTRACT_COUNTS)) {
    check(name, actual === expected, expected, actual, '')
  }

  // Wormadam's cloak learnsets re-point learnset slots: `1 - Bug Bite >> Amnesia`.
  // Both halves must survive — the new move *and* what it replaced. After the
  // rev-4 promotion six of the nineteen sit in Wormadam's own level-up list (the
  // Plant Cloak list *is* the species' list) and thirteen stay per-form, so the
  // total is unchanged while its distribution is not; the note lists where each
  // one lives so a regression that moves or drops one is visible in the output.
  const replacesByLocation = pokemon.flatMap((p) => {
    const count = (list) => list.filter((e) => e.replaces).length
    const rows = []
    const own = count(p.learnset.levelUp)
    if (own) rows.push([`${p.name} (species-level learnset)`, own])
    for (const f of p.forms) {
      const n = count(f.levelUp ?? [])
      if (n) rows.push([`${p.name} — ${f.form}`, n])
    }
    return rows
  })
  const replacesSinnohan = sinnohan.reduce((n, f) => n + f.learnset.levelUp.filter((e) => e.replaces).length, 0)
  if (replacesSinnohan) replacesByLocation.push(['Sinnohan forms', replacesSinnohan])
  const replacesCount = replacesByLocation.reduce((n, [, count]) => n + count, 0)
  check(
    'LearnEntry.replaces count',
    replacesCount === 19,
    19,
    replacesCount,
    `Wormadam cloaks — ${replacesByLocation.map(([where, count]) => `${where}: ${count}`).join(', ')}`,
  )

  const CHANGE_KINDS = ['type', 'stats', 'ability', 'moves', 'learnset', 'evolution', 'item', 'form', 'other']
  const SEARCH_KINDS = [
    'pokemon', 'sinnohan', 'type', 'move', 'item', 'evolution',
    'trainer', 'wild', 'event', 'npc', 'trade', 'faq', 'guide', 'doc',
  ]
  const TYPES = POKEMON_TYPES
  const APP_ROUTES = new Set([
    '#/', '#/pokemon', '#/sinnohan', '#/types', '#/moves', '#/items', '#/evolutions',
    '#/trainers', '#/wild', '#/events', '#/guides', '#/guides/faq', '#/guides/npc',
    '#/guides/trades', '#/guides/level-caps', '#/guides/action-replay',
    '#/guides/changelog', '#/search',
  ])
  const isAppRoute = (route) =>
    APP_ROUTES.has(route) ||
    /^#\/pokemon\/[a-z0-9-]+$/.test(route) ||
    /^#\/sinnohan\/[a-z0-9-]+$/.test(route)

  const badKind = pokemon.flatMap((p) => p.changeKinds.filter((k) => !CHANGE_KINDS.includes(k)))
  const badSearchKind = searchIndex.filter((r) => !SEARCH_KINDS.includes(r.kind))
  const badRoutes = searchIndex.filter((r) => !isAppRoute(r.route))
  const badRoutesInMeta = documents.filter((d) => !isAppRoute(d.route))
  const allTypes = new Set([
    ...pokemon.flatMap((p) => [...(p.type?.old ?? []), ...(p.type?.new ?? []), ...(p.baseTypes ?? [])]),
    ...pokemon.flatMap((p) => p.forms.flatMap((f) => f.types ?? [])),
    ...sinnohan.flatMap((f) => [...f.types, ...(f.replacedTypes ?? [])]),
    ...typeChanges.pokemonChanges.flatMap((t) => [...t.oldTypes, ...t.newTypes]),
  ])
  const badTypes = [...allTypes].filter((t) => !TYPES.includes(t))

  for (const kind of badKind) log.warn(`invalid ChangeKind emitted: ${kind}`)
  for (const record of badSearchKind) log.warn(`invalid SearchKind emitted: ${record.kind}`)
  for (const record of badRoutes) log.warn(`search record points at an unknown route: ${record.route}`)
  for (const type of badTypes) log.warn(`unknown type name emitted: ${type}`)

  check('every ChangeKind is valid', badKind.length === 0, '0 invalid', `${badKind.length} invalid`)
  check('every SearchKind is valid', badSearchKind.length === 0, '0 invalid', `${badSearchKind.length} invalid`)
  check('every route is a known app route', badRoutes.length + badRoutesInMeta.length === 0, '0 invalid', `${badRoutes.length + badRoutesInMeta.length} invalid`)
  check('every type name is a valid PType', badTypes.length === 0, '0 invalid', `${badTypes.length} invalid`)
  check('PokemonChange.dex unique', uniqueDex(pokemon), 'unique', uniqueDex(pokemon) ? 'unique' : 'duplicates')
  check('SinnohanForm.dex unique', uniqueDex(sinnohan), 'unique', uniqueDex(sinnohan) ? 'unique' : 'duplicates')
  check(
    'every StatBlock bst === sum(stats)',
    badBst.length === 0,
    '0 mismatches',
    `${badBst.length} mismatches`,
    badBst.length ? '' : 'source BST errors were recomputed; see WARNINGS',
  )
  check(
    'RawSection coverage >= source body lines',
    uncovered.length === 0,
    '0 shortfalls',
    `${uncovered.length} shortfalls`,
  )

  /* ---- rev-2 enrichment invariants -------------------------------- */

  const missingBaseStats = pokemon.filter((p) => !p.baseStats)
  const badBaseStatsSource = pokemon.filter(
    (p) => !['documented', 'baseline'].includes(p.baseStatsSource),
  )
  const wrongBaseStats = pokemon.filter((p) => {
    if (!p.baseStats) return false
    const expected = p.stats?.new ?? (p.baseStatsSource === 'baseline' ? p.baseStats : null)
    return expected ? statSum(p.baseStats) !== statSum(expected) : false
  })
  const badBaseStatsBst = pokemon.filter((p) => p.baseStats && p.baseStats.bst !== statSum(p.baseStats))

  const tmFilled = pokemon.filter((p) => p.learnset.tm.length > 0).length
  const tutorFilled = pokemon.filter((p) => p.learnset.tutor.length > 0).length
  const levelUpFilled = pokemon.filter((p) => p.learnset.levelUp.length > 0).length
  const sinnohanTm = sinnohan.filter((s) => s.learnset.tm.length > 0).length
  const sinnohanTutor = sinnohan.filter((s) => s.learnset.tutor.length > 0).length
  const sinnohanNoReplaced = sinnohan.filter((s) => !s.replacedTypes?.length || !s.replacedStats)
  /*
   * `includesBaseline` must be set exactly when baseline entries were merged.
   * Five species (Ditto, Unown, Wobbuffet, Smeargle, Wynaut) have no TM/HM or
   * tutor compatibility at all in vanilla Platinum, so their documented
   * learnsets stay flagged as documented-only.
   */
  const baselineHasList = (dex) => {
    const base = baseline.at(dex)
    return (base?.machine.length ?? 0) > 0 || (base?.tutor.length ?? 0) > 0
  }
  const includesBaselineMissing = pokemon.filter(
    (p) => baselineHasList(p.dex) && p.learnset.includesBaseline !== true,
  )
  const noBaselineLists = pokemon.filter(
    (p) => !baselineHasList(p.dex) && p.learnset.tm.length === 0 && p.learnset.tutor.length === 0,
  )

  check('every PokemonChange has baseStats', missingBaseStats.length === 0, '493/493', `${pokemon.length - missingBaseStats.length}/${pokemon.length}`)
  check('every baseStatsSource is documented|baseline', badBaseStatsSource.length === 0, '0 invalid', `${badBaseStatsSource.length} invalid`)
  check('baseStats matches the documented New block', wrongBaseStats.length === 0, '0 mismatches', `${wrongBaseStats.length} mismatches`)
  check('every baseStats bst === sum(stats)', badBaseStatsBst.length === 0, '0 mismatches', `${badBaseStatsBst.length} mismatches`)
  check('learnset.tm non-empty (baseline completed)', tmFilled >= 400, '>= 400', String(tmFilled))
  check('learnset.tutor non-empty (baseline completed)', tutorFilled >= 400, '>= 400', String(tutorFilled))
  check('learnset.levelUp non-empty', levelUpFilled === pokemon.length, `${pokemon.length}`, String(levelUpFilled))
  check('Sinnohan TM/tutor lists resolved', sinnohanTm >= 60 && sinnohanTutor >= 60, '>= 60 each', `${sinnohanTm} / ${sinnohanTutor}`)
  check('every SinnohanForm has replacedTypes + replacedStats', sinnohanNoReplaced.length === 0, '65/65', `${sinnohan.length - sinnohanNoReplaced.length}/${sinnohan.length}`)
  check('includesBaseline set whenever baseline lists were merged', includesBaselineMissing.length === 0, '0 missing', `${includesBaselineMissing.length} missing`)
  // A TM/tutor list can never be made of `(!!)` additions only: the documents
  // state additions, so every non-empty list must also hold baseline entries.
  const additionsOnly = pokemon.filter(
    (p) =>
      (p.learnset.tm.length > 0 && p.learnset.tm.every((t) => t.isNew)) ||
      (p.learnset.tutor.length > 0 && p.learnset.tutor.every((t) => t.isNew)),
  )
  const normName = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
  const duplicateTm = pokemon.filter((p) => {
    const nums = p.learnset.tm.map((t) => t.num)
    return new Set(nums).size !== nums.length
  })
  const duplicateTutor = pokemon.filter((p) => {
    const moves = p.learnset.tutor.map((t) => normName(t.move))
    return new Set(moves).size !== moves.length
  })
  check(
    'no learnset repeats a TM number',
    duplicateTm.length === 0,
    '0 duplicates',
    `${duplicateTm.length} duplicates`,
  )
  check(
    'no learnset repeats a tutor move',
    duplicateTutor.length === 0,
    '0 duplicates',
    `${duplicateTutor.length} duplicates`,
  )
  check(
    'no TM/tutor list is made only of (!!) additions',
    additionsOnly.length === 0,
    '0 invalid',
    `${additionsOnly.length} invalid`,
  )
  if (noBaselineLists.length)
    log.note(
      `vanilla Platinum gives no TM/HM or tutor compatibility to ${noBaselineLists.length} species ` +
        `(${noBaselineLists.map((p) => p.name).join(', ')}) — their lists stay as documented`,
    )

  /* ---- rev-3 types & alternate forms ------------------------------ */

  /*
   * Problem 1 — every entry must carry the vanilla typing, because the
   * documents re-type only 69 of the 493 species: without `baseTypes`, the
   * other 424 (every legendary among them) had no type to display at all.
   */
  const missingBaseTypes = pokemon.filter((p) => !p.baseTypes || p.baseTypes.length === 0)
  const wrongBaseTypesSource = pokemon.filter((p) => p.baseTypesSource !== 'baseline')
  const invalidBaseTypes = pokemon.filter((p) => p.baseTypes && !isValidTypeList(p.baseTypes))

  /*
   * Problem 2 — the two lists the documents state explicitly must be complete,
   * non-empty lists of real type names. Whether they *agree* with the baseline
   * is a review question (`crossCheckTypes`), not an assertion: Sinnohan forms
   * legitimately do full retypes and the `Old` column of TypeChanges.txt is
   * sometimes a later generation's typing.
   */
  const invalidDocumentOld = typeChanges.pokemonChanges.filter((entry) => !isValidTypeList(entry.oldTypes))
  const invalidReplacedTypes = sinnohan.filter((form) => !isValidTypeList(form.replacedTypes))
  const sinnohanBaseTypesAgree = pokemon.filter((p) => {
    if (!p.isSinnohan) return false
    const form = sinnohan.find((s) => s.dex === p.dex)
    return !form || !sameTypeList(p.baseTypes ?? [], form.replacedTypes ?? [])
  })

  /*
   * Problem 4 — every species the codex lists alternate forms for must resolve
   * each of them, with its types, from the baseline. The species' own default
   * form is represented by `baseTypes` and is never listed as a variant: when a
   * document scopes a section to it (Deoxys' Normal Forme, Wormadam's Plant
   * Cloak, Shaymin's Land Forme) that section is promoted to the entry's own
   * field instead (rev 4), so `forms[]` holds the true alternates only.
   */
  const formSpecies = []
  for (const p of pokemon) {
    const baseForms = baseline.formsAt(p.dex)
    if (baseForms.length === 0) continue
    const defaultForm = baseForms.find((f) => f.isDefault)
    const alternates = baseForms.filter((f) => !f.isDefault)
    const listed = p.forms.filter((f) => f.types && f.types.length > 0)
    formSpecies.push({
      dex: p.dex,
      name: p.name,
      baseTypes: p.baseTypes ?? [],
      alternates: alternates.map((f) => `${f.name ?? f.slug} (${f.types.join('/')})`),
      listed: listed.map((f) => `${f.form} (${f.types.join('/')})`),
      defaultMatchesBaseTypes: Boolean(defaultForm) && sameTypeList(defaultForm.types, p.baseTypes ?? []),
      // Exact, not `>=`: every vanilla alternate form is listed and nothing else
      // is, so a promoted default form or a dropped alternate both fail here.
      resolved: listed.length === alternates.length,
    })
  }
  const formShortfall = formSpecies.filter((s) => !s.resolved || !s.defaultMatchesBaseTypes)
  const untaggedForms = pokemon.flatMap((p) =>
    baseline.formsAt(p.dex).length > 0
      ? p.forms.filter((f) => !f.types || f.types.length === 0).map((f) => `${p.name} — ${f.form}`)
      : [],
  )
  const typedFormCount = pokemon.reduce((n, p) => n + p.forms.filter((f) => f.types?.length).length, 0)

  check('every PokemonChange has baseTypes', missingBaseTypes.length === 0, '493/493', `${pokemon.length - missingBaseTypes.length}/${pokemon.length}`)
  check('every baseTypesSource is baseline', wrongBaseTypesSource.length === 0, '0 invalid', `${wrongBaseTypesSource.length} invalid`)
  check('every baseTypes is a non-empty list of valid PType', invalidBaseTypes.length === 0, '0 invalid', `${invalidBaseTypes.length} invalid`)
  check(
    'every TypeChanges oldTypes is a non-empty list of valid PType',
    invalidDocumentOld.length === 0,
    '0 invalid',
    `${invalidDocumentOld.length} invalid`,
  )
  check(
    'every SinnohanForm.replacedTypes is a non-empty list of valid PType',
    invalidReplacedTypes.length === 0,
    '0 invalid',
    `${invalidReplacedTypes.length} invalid`,
  )
  check(
    'Sinnohan entries: baseTypes === replacedTypes',
    sinnohanBaseTypesAgree.length === 0,
    '0 mismatches',
    `${sinnohanBaseTypesAgree.length} mismatches`,
  )
  check(
    'every alternate form is listed with its types',
    formShortfall.length === 0 && untaggedForms.length === 0,
    '0 shortfalls',
    `${formShortfall.length} shortfalls / ${untaggedForms.length} untagged`,
    formSpecies.map((s) => `${s.name}: ${s.listed.length}`).join(', '),
  )
  if (untaggedForms.length) for (const form of untaggedForms) log.warn(`alternate form without types: ${form}`)

  // The two shapes the user reported, checked by name.
  const arceus = pokemon.find((p) => p.slug === 'arceus')
  check(
    'Arceus.baseTypes === [Normal] (legendary the documents never re-type)',
    Boolean(arceus) && sameTypeList(arceus.baseTypes ?? [], ['Normal']),
    'Normal',
    (arceus?.baseTypes ?? []).join(' / ') || 'missing',
  )
  const charizardBase = pokemon.find((p) => p.slug === 'charizard')
  check(
    'Charizard.baseTypes === [Fire, Flying] (Gen IV, not the Fairy-era list)',
    Boolean(charizardBase) && sameTypeList(charizardBase.baseTypes ?? [], ['Fire', 'Flying']),
    'Fire / Flying',
    (charizardBase?.baseTypes ?? []).join(' / ') || 'missing',
  )
  const rotomEntry = pokemon.find((p) => p.slug === 'rotom')
  const rotomForms = rotomEntry?.forms ?? []
  const rotomExpected = [
    ['Heat Rotom', ['Electric', 'Fire']],
    ['Wash Rotom', ['Electric', 'Water']],
    ['Frost Rotom', ['Electric', 'Ice']],
    ['Fan Rotom', ['Electric', 'Flying']],
    ['Mow Rotom', ['Electric', 'Grass']],
  ]
  const rotomFormsOk =
    rotomForms.length === rotomExpected.length &&
    rotomExpected.every(([form, types]) => {
      const variant = rotomForms.find((f) => f.form === form)
      return variant && sameTypeList(variant.types ?? [], types)
    })
  const rotomFanAbility = rotomForms.find((f) => f.form === 'Fan Rotom')?.ability
  check(
    'Rotom: stats are species-level (440 -> 520) and no "Regular Form" pseudo-form',
    Boolean(rotomEntry?.stats) &&
      rotomEntry.stats.old.bst === 440 &&
      rotomEntry.stats.new.bst === 520 &&
      !rotomForms.some((f) => /regular/i.test(f.form)),
    '440 -> 520 / 0 pseudo-form',
    rotomEntry?.stats ? `${rotomEntry.stats.old.bst} -> ${rotomEntry.stats.new.bst} / ${rotomForms.length} form(s)` : 'no stats',
  )
  check(
    'Rotom: five alternate forms with their Gen-V types',
    rotomFormsOk,
    'Heat/Wash/Frost/Fan/Mow',
    rotomForms.map((f) => `${f.form}${f.types ? ` (${f.types.join('/')})` : ''}`).join(', ') || 'missing',
  )
  check(
    'Rotom: Fan Rotom keeps Levitate -> Motor Drive',
    Boolean(rotomFanAbility) &&
      sameTypeList(rotomFanAbility.old, ['Levitate']) &&
      sameTypeList(rotomFanAbility.new, ['Motor Drive']),
    'Levitate -> Motor Drive',
    rotomFanAbility ? `${rotomFanAbility.old.join('/')} -> ${rotomFanAbility.new.join('/')}` : 'missing',
  )

  /*
   * rev 4 — the species' own default form is promoted, not turned into a
   * pseudo-form. Wormadam *is* its Plant Cloak (the cloak it has when Burmy
   * evolves in grass), so its `Base Stats`, `Ability` and `Level Up` sections
   * must fill Wormadam's own fields; only the two alternate cloaks stay forms.
   */
  const wormadam = pokemon.find((p) => p.slug === 'wormadam')
  const wormadamStats = wormadam?.stats
  check(
    'Wormadam: stats are species-level — the Plant Cloak change (60/59/85/79/105/36 -> 70/50/90/120/110/60)',
    Boolean(wormadamStats) &&
      [wormadamStats.old.hp, wormadamStats.old.atk, wormadamStats.old.def, wormadamStats.old.spa, wormadamStats.old.spd, wormadamStats.old.spe].join('/') ===
        '60/59/85/79/105/36' &&
      [wormadamStats.new.hp, wormadamStats.new.atk, wormadamStats.new.def, wormadamStats.new.spa, wormadamStats.new.spd, wormadamStats.new.spe].join('/') ===
        '70/50/90/120/110/60' &&
      wormadamStats.old.bst === 424 &&
      wormadamStats.new.bst === 500,
    '424 -> 500 BST',
    wormadamStats
      ? `${wormadamStats.old.bst} -> ${wormadamStats.new.bst} BST`
      : 'no stats (still buried in a pseudo-form)',
  )
  const wormadamAbility = wormadam?.ability
  check(
    'Wormadam: ability is species-level — the Plant Cloak ability (Anticipation -> Chlorophyll / Unaware)',
    Boolean(wormadamAbility) &&
      sameTypeList(wormadamAbility.old, ['Anticipation']) &&
      sameTypeList(wormadamAbility.new, ['Chlorophyll', 'Unaware']),
    'Anticipation -> Chlorophyll / Unaware',
    wormadamAbility
      ? `${wormadamAbility.old.join('/')} -> ${wormadamAbility.new.join('/')}`
      : 'no ability (still buried in a pseudo-form)',
  )
  check(
    'Wormadam: one documented level-up list at species-level (the Plant Cloak learnset)',
    (wormadam?.learnset.levelUp.length ?? 0) > 0 &&
      (wormadam?.learnset.levelUp ?? []).every((e) => Number.isInteger(e.level)),
    'non-empty',
    `${wormadam?.learnset.levelUp.length ?? 0} list entry(ies), ` +
      `${(wormadam?.learnset.levelUp ?? []).filter((e) => e.replaces).length} with a ">>" replacement`,
  )
  const wormadamForms = wormadam?.forms ?? []
  check(
    'Wormadam: forms are exactly the two genuine alternate cloaks (no "Plant Cloak" pseudo-form)',
    wormadamForms.length === 2 &&
      wormadamForms.map((f) => f.form).join(' | ') === 'Sandy Cloak | Trash Cloak' &&
      sameTypeList(wormadamForms[0]?.types ?? [], ['Bug', 'Ground']) &&
      sameTypeList(wormadamForms[1]?.types ?? [], ['Bug', 'Steel']),
    'Sandy Cloak (Bug/Ground), Trash Cloak (Bug/Steel)',
    wormadamForms.map((f) => `${f.form}${f.types ? ` (${f.types.join('/')})` : ''}`).join(', ') || 'missing',
  )

  /*
   * The two other species whose default form the documents scope. Same rule, so
   * the same outcome: their documented default-form learnset is the species'
   * learnset and only the true alternates stay forms.
   */
  const deoxys = pokemon.find((p) => p.slug === 'deoxys')
  check(
    'Deoxys: Normal Forme learnset is species-level; only Attack/Defense/Speed stay forms',
    Boolean(deoxys) &&
      deoxys.learnset.levelUp.length > 0 &&
      deoxys.forms.map((f) => f.form).join(' | ') === 'Attack Forme | Defense Forme | Speed Forme',
    'Attack Forme | Defense Forme | Speed Forme',
    deoxys ? deoxys.forms.map((f) => f.form).join(' | ') || 'no forms' : 'missing',
  )
  const shaymin = pokemon.find((p) => p.slug === 'shaymin')
  check(
    'Shaymin: Land Forme learnset is species-level; only Sky Forme stays a form',
    Boolean(shaymin) &&
      shaymin.learnset.levelUp.length > 0 &&
      shaymin.forms.map((f) => f.form).join(' | ') === 'Sky Forme',
    'Sky Forme',
    shaymin ? shaymin.forms.map((f) => f.form).join(' | ') || 'no forms' : 'missing',
  )
  const eevee = pokemon.find((p) => p.slug === 'eevee')
  check(
    'Eevee: `Base Stats (All Evolutions)` stays a variant (it names other Pokémon)',
    Boolean(eevee) &&
      eevee.forms.length === 1 &&
      eevee.forms[0].form === 'All Evolutions' &&
      !eevee.stats,
    'All Evolutions',
    eevee ? `${eevee.forms.map((f) => f.form).join(', ') || 'no forms'} / species stats ${eevee.stats ? 'set' : 'unset'}` : 'missing',
  )

  /* ---- rev-3 type cross-checks (review lists, not assertions) ----- */

  const typeCrossCheck = crossCheckTypes({ pokemon, sinnohan, typeChanges, baseline })
  const relationCounts = {}
  for (const row of typeCrossCheck.sinnohanRows) {
    relationCounts[row.relation] = (relationCounts[row.relation] ?? 0) + 1
  }
  const documentMismatch = typeCrossCheck.documentRows.filter((row) => !row.matchesBaseline)
  const documentDisagreement = typeCrossCheck.consistency.filter((row) => !row.agrees)

  log.note(
    `rev 3 — baseTypes filled from the baseline for ${enrichment.baseTypesFilled} of ${pokemon.length} entries ` +
      `(${enrichment.baseTypesMissing} unresolved)`,
  )
  log.note(
    `rev 3 — alternate forms: ${typedFormCount} form(s) across ${formSpecies.length} species carry types ` +
      `(${enrichment.formTypesFromDocument} matched a documented scope, ${enrichment.formsSynthesized} added from the ` +
      'baseline because no document mentions the form)',
  )
  if (pokemonDoc.promotions.length) {
    log.note(
      `rev 4 — form-scoped sections read as species-level (the scope names the species itself): ` +
        pokemonDoc.promotions
          .map(
            (p) =>
              `${String(p.dex).padStart(3, '0')} ${p.name} — ${p.label} (${p.scope}) ` +
              `[${p.reason === 'species-default-form' ? 'own default form' : 'alias for the species'}]`,
          )
          .join('; '),
    )
  }
  log.note(
    `rev 3 — ${typeCrossCheck.sinnohanRows.length} Sinnohan forms cross-checked against the species they replace ` +
      `(${Object.entries(relationCounts).map(([k, v]) => `${k} ${v}`).join(', ')}); ` +
      `${documentMismatch.length} of ${typeCrossCheck.documentRows.length} TypeChanges.txt rows disagree with the ` +
      'vanilla Gen-IV typing — full lists below',
  )

  // The two gaps the user reported, checked by name.
  const charizardCheck = pokemon.find((p) => p.slug === 'charizard')
  const charizardTutor = (charizardCheck?.learnset.tutor ?? []).some((t) => t.move === 'Draco Meteor' && t.isNew)
  const charizardTm = (charizardCheck?.learnset.tm ?? []).some((t) => t.num === '88' && t.move === 'Hurricane' && t.isNew)
  check('Charizard: tutor list contains Draco Meteor (isNew)', charizardTutor, 'present', charizardTutor ? 'present' : 'missing')
  check('Charizard: TM list contains TM88 Hurricane (isNew)', charizardTm, 'present', charizardTm ? 'present' : 'missing')

  const sinnohanAbsol = sinnohan.find((s) => s.slug === 'sinnohan-absol')
  const absolOk =
    Boolean(sinnohanAbsol) &&
    sinnohanAbsol.replacedTypes?.join('/') === 'Dark' &&
    sinnohanAbsol.types.join('/') === 'Dark/Steel'
  check(
    'Sinnohan Absol: replacedTypes [Dark], types [Dark, Steel]',
    absolOk,
    'Dark -> Dark/Steel',
    sinnohanAbsol ? `${sinnohanAbsol.replacedTypes?.join('/')} -> ${sinnohanAbsol.types.join('/')}` : 'missing',
  )

  // Grouped move changes: one record, six moves, three shared changes, one exception.
  const fireBlastGroup = moves.groupModifications.find((g) => g.moves[0] === 'Fire Blast')
  const fireBlastOk =
    Boolean(fireBlastGroup) &&
    fireBlastGroup.moves.length === 6 &&
    fireBlastGroup.changes.length === 3 &&
    fireBlastGroup.exceptions.length === 1 &&
    fireBlastGroup.exceptions[0].moves.join('/') === 'Hurricane'
  check(
    'Fire Blast group: 6 moves, 3 changes, 1 Hurricane exception',
    fireBlastOk,
    '6 / 3 / 1 Hurricane',
    fireBlastGroup
      ? `${fireBlastGroup.moves.length} / ${fireBlastGroup.changes.length} / ${fireBlastGroup.exceptions.length} ${fireBlastGroup.exceptions[0]?.moves.join('/') ?? '-'}`
      : 'missing',
  )
  const strayGroupProse = moves.modifications.filter((m) => m.changes.length === 0 && m.exceptions.length === 0)
  check(
    'no empty modification record (group prose lives in groupNotes)',
    strayGroupProse.length === 0 && moves.groupNotes.length > 0,
    '0 stray / >=1 note',
    `${strayGroupProse.length} stray / ${moves.groupNotes.length} note(s)`,
  )
  const badExceptions = [...moves.modifications, ...moves.groupModifications].flatMap((m) =>
    m.exceptions.filter((e) => e.moves.some((move) => !m.moves.includes(move))),
  )
  check(
    'every MoveFieldException targets a move of its record',
    badExceptions.length === 0,
    '0 invalid',
    `${badExceptions.length} invalid`,
  )
  const duplicateSearchIds = searchIndex.length - new Set(searchIndex.map((r) => r.id)).size
  check('every search record id is unique', duplicateSearchIds === 0, '0 duplicates', `${duplicateSearchIds} duplicates`)

  /* ---- print ----------------------------------------------------- */

  const failed = checks.filter((c) => !c.ok)

  console.log('')
  console.log(`${HACK} — data build`)
  console.log('='.repeat(78))
  console.log('')

  console.log('OUTPUT FILES')
  console.log(`  ${pad('file', 22)} ${pad('records', 9)} ${pad('bytes', 10)} source`)
  const sourcesFor = {
    'meta.json': 'all 14 source documents',
    'pokemon.json': 'PokemonChanges.txt',
    'sinnohan.json': 'SinnohanForms.txt',
    'type-changes.json': 'TypeChanges.txt',
    'moves.json': 'MoveChanges.txt',
    'items.json': 'ItemChanges.txt',
    'evolutions.json': 'EvolutionChanges.txt',
    'trainers.json': 'TrainerPokemon.txt (+ LevelCaps.txt)',
    'wild.json': 'WildPokemon.txt',
    'events.json': 'SpecialEvents.txt',
    'misc.json': 'NPC/Trade/LevelCaps/FAQ/ActionReplay',
    'changelog.json': 'Changelog.txt (absent from data/source)',
    'search-index.json': 'all of the above',
  }
  let totalBytes = 0
  for (const [file, value] of outputs) {
    const bytes = sizes.get(file)
    totalBytes += bytes
    console.log(`  ${pad(file, 22)} ${pad(recordCount(value), 9)} ${num(bytes)}  ${sourcesFor[file]}`)
  }
  console.log(`  ${pad('TOTAL', 22)} ${pad('', 9)} ${num(totalBytes)}`)

  console.log('')
  console.log('ASSERTIONS')
  for (const c of checks) {
    const status = c.ok ? (c.note ? 'PASS*' : 'PASS ') : 'FAIL '
    console.log(`  ${status} ${pad(c.name, 42)} expected ${pad(c.expected, 14)} actual ${c.actual}`)
    if (c.note) console.log(`         ↳ ${c.note}`)
  }

  console.log('')
  console.log('PARSED CONTENT')
  const content = [
    ['Pokémon entries', pokemon.length],
    ['  with a type change', meta.counts.pokemonWithTypeChange],
    ['  with baseTypes (rev 3)', pokemon.filter((p) => p.baseTypes?.length).length],
    ['  with a stat change', meta.counts.pokemonWithStatChange],
    ['  with an ability change', meta.counts.pokemonWithAbilityChange],
    ['  Sinnohan entries marked in Pokémon Changes', pokemon.filter((p) => p.isSinnohan).length],
    ['  form variants (Rotom, Deoxys, Wormadam, ...)', pokemon.reduce((n, p) => n + p.forms.length, 0)],
    ['    form variants with types (rev 3)', typedFormCount],
    ['    species with alternate forms resolved', formSpecies.length],
    ['    "form change not documented" notes', enrichment.formChangeNotes],
    ['  with baseStats (all)', pokemon.filter((p) => p.baseStats).length],
    ['    baseStatsSource documented', enrichment.statsDocumented],
    ['    baseStatsSource baseline', enrichment.statsFilled],
    ['  learnset.tm non-empty', tmFilled],
    ['  learnset.tutor non-empty', tutorFilled],
    ['  learnset.levelUp non-empty', levelUpFilled],
    ['  TM/HM entries emitted', pokemon.reduce((n, p) => n + p.learnset.tm.length, 0)],
    ['  move-tutor entries emitted', pokemon.reduce((n, p) => n + p.learnset.tutor.length, 0)],
    ['Sinnohan forms', sinnohan.length],
    ['  total level-up moves', sinnohan.reduce((n, f) => n + f.learnset.levelUp.length, 0)],
    ['  with replacedTypes / replacedStats', sinnohan.filter((f) => f.replacedTypes?.length && f.replacedStats).length],
    ['Type changes (chart cells)', typeChanges.chartChanges.length],
    ['Type changes (Pokémon)', typeChanges.pokemonChanges.length],
    ['Move replacements', moves.replacements.length],
    ['New moves', moves.newMoves.length],
    ['Move modifications (single)', moves.modifications.length],
    ['Move modifications (grouped)', moves.groupModifications.length],
    ['Move group notes', moves.groupNotes.length],
    ['Items: usable', items.usableItems.length],
    ['Items: cost changes', items.costChanges.length],
    ['Items: TM move changes', items.tmChanges.length],
    ['Items: locations', items.itemLocations.length],
    ['Items: TM locations', items.tmLocations.length],
    ['Items: plate locations', items.plateLocations.length],
    ['Items: replaced', items.replacedItems.length],
    ['Evolution sections', evolutions.sections.length],
    ['Trainer areas', trainers.areas.length],
    ['Trainer lines', meta.counts.trainers],
    ['Boss teams', trainers.areas.reduce((n, a) => n + a.bosses.length, 0)],
    ['Wild areas', wild.areas.length],
    ['Wild encounter methods', wild.areas.reduce((n, a) => n + a.methods.length, 0)],
    ['Event items', meta.counts.events],
    ['NPC sections', npc.length],
    ['Trades', trade.trades.length],
    ['FAQ entries', faq.length],
    ['Search records', searchIndex.length],
    ['StatBlocks verified for BST', statBlocks.length],
  ]
  for (const [label, value] of content) console.log(`  ${pad(label, 46)} ${num(value)}`)

  /* ---- rev-3 cross-checks ---------------------------------------- */

  console.log('')
  console.log('TYPE CROSS-CHECKS (review lists — printed in full, never asserted)')

  console.log('')
  console.log(`  1. Sinnohan forms: replaced species (baseline, Gen IV) vs the documented form typing`)
  console.log(`     ${pad('dex', 5)} ${pad('form', 26)} ${pad('replaced (baseline)', 20)} ${pad('documented form', 20)} relation`)
  for (const row of typeCrossCheck.sinnohanRows) {
    console.log(
      `     ${pad(String(row.dex).padStart(3, '0'), 5)} ${pad(row.name, 26)} ${pad(row.replacedTypes.join(' / '), 20)} ` +
        `${pad(row.types.join(' / '), 20)} ${row.relation}`,
    )
  }
  console.log(
    `     ${typeCrossCheck.sinnohanRows.length} form(s): ` +
      Object.entries(relationCounts).map(([k, v]) => `${k} ${v}`).join(', ') +
      ` — a "full-retype" shares no type with the replaced species and is reviewed by hand`,
  )

  console.log('')
  console.log(
    `  2. TypeChanges.txt: the document's own "Old" column vs the baseline's Gen-IV typing ` +
      `(${typeCrossCheck.documentRows.length} rows, ${documentMismatch.length} disagreement(s))`,
  )
  if (documentMismatch.length === 0) {
    console.log('     none — every stated Old type equals vanilla Platinum')
  } else {
    for (const row of documentMismatch) {
      console.log(
        `     ${pad(String(row.dex).padStart(3, '0'), 5)} ${pad(row.name, 14)} document Old ${pad(row.documentOld.join(' / '), 18)} ` +
          `baseline Gen IV ${pad(row.baselineGenFour.join(' / '), 16)} PokeAPI current ${pad(row.baselineCurrent.join(' / '), 16)} ${row.diagnosis}`,
      )
    }
  }

  console.log('')
  console.log(
    `  3. PokemonChanges.txt vs TypeChanges.txt on the same species ` +
      `(${typeCrossCheck.consistency.length} comparable, ${documentDisagreement.length} disagreement(s))`,
  )
  if (documentDisagreement.length === 0) {
    console.log('     none — the two documents state the same new typing')
  } else {
    for (const row of documentDisagreement) {
      console.log(
        `     ${pad(String(row.dex).padStart(3, '0'), 5)} ${pad(row.name, 22)} TypeChanges ${pad(row.fromDocument.join(' / '), 20)} ` +
          `PokemonChanges ${row.fromPokemonChanges.join(' / ')}`,
      )
    }
  }

  console.log('')
  console.log(`  Alternate forms resolved from the baseline (FormVariant.types)`)
  for (const species of formSpecies) {
    console.log(`     ${pad(String(species.dex).padStart(3, '0'), 5)} ${pad(species.name, 12)} baseTypes ${pad(species.baseTypes.join(' / '), 14)} forms: ${species.listed.join(', ')}`)
  }

  console.log('')
  console.log('WARNINGS')
  if (!log.warnings.length) console.log('  none')
  for (const warning of log.warnings) console.log(`  ! ${warning}`)

  console.log('')
  console.log('NOTES')
  for (const note of log.notes) console.log(`  - ${note}`)

  console.log('')
  console.log('UNPARSED LINES (retained in RawSection / noteSections)')
  console.log(`  total: ${log.unparsedTotal}`)
  for (const bucket of log.perFile()) {
    console.log(`  ${pad(bucket.file, 30)} ${num(bucket.count)}`)
    for (const sample of bucket.samples.slice(0, 6)) {
      console.log(`        line ${String(sample.line).padStart(6)}: ${sample.text.slice(0, 96)}`)
      console.log(`                      ↳ ${sample.reason}`)
    }
  }

  console.log('')
  if (fs.existsSync(SPRITE_DIR)) {
    const sprites = fs.readdirSync(SPRITE_DIR).filter((f) => f.endsWith('.png'))
    console.log(`Sprites present: ${sprites.length} (public/sprites) — run \`node scripts/fetch-sprites.mjs\` to fetch missing ones.`)
  } else {
    console.log('Sprites: public/sprites does not exist yet — run `node scripts/fetch-sprites.mjs`.')
  }

  console.log('')
  if (failed.length) {
    console.log(`BUILD FAILED — ${failed.length} assertion(s) failed:`)
    for (const c of failed) console.log(`  - ${c.name}: expected ${c.expected}, got ${c.actual}`)
    console.log('')
    process.exit(1)
  }
  console.log(`BUILD OK — ${outputs.length} files written to public/data/`)
  console.log('')
}

main()
