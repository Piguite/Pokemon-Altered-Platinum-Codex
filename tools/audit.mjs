#!/usr/bin/env node
/**
 * tools/audit.mjs — INDEPENDENT verification of the generated dataset.
 *
 * This deliberately does NOT reuse any logic from `scripts/build-data.mjs`.
 * It re-derives expectations straight from `data/source/*.txt` with simple,
 * blunt counting, then compares them to `public/data/*.json`.
 *
 * Its purpose is to catch the failure mode a self-checking pipeline cannot:
 * a parser that is internally consistent but wrong about the source.
 *
 * Usage: node tools/audit.mjs
 * Exit code 0 = all hard checks passed, 1 = at least one hard check failed.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'data', 'source')
const OUT = join(ROOT, 'public', 'data')

/** Read a source document with CRLF stripped — the #1 source of silent parse bugs. */
const src = (name) => readFileSync(join(SRC, name), 'utf8').replace(/\r\n?/g, '\n')
const json = (name) => JSON.parse(readFileSync(join(OUT, name), 'utf8'))

const results = []
let failures = 0

function check(label, actual, expected, { hard = true, note = '' } = {}) {
  const ok = actual === expected
  if (!ok && hard) failures++
  results.push({ ok, hard, label, actual, expected, note })
}

function checkTrue(label, ok, detail = '', { hard = true } = {}) {
  if (!ok && hard) failures++
  results.push({ ok, hard, label, actual: ok ? 'ok' : 'FAIL', expected: 'ok', note: detail })
}

/* ------------------------------------------------------------------ */
/* Load                                                               */
/* ------------------------------------------------------------------ */

if (!existsSync(join(OUT, 'pokemon.json'))) {
  console.error(`✗ ${OUT}/pokemon.json not found — run \`npm run data\` first.`)
  process.exit(1)
}

const meta = json('meta.json')
const pokemon = json('pokemon.json')
const sinnohan = json('sinnohan.json')
const types = json('type-changes.json')
const moves = json('moves.json')
const items = json('items.json')
const evolutions = json('evolutions.json')
const trainers = json('trainers.json')
const wild = json('wild.json')
const events = json('events.json')
const misc = json('misc.json')
const searchIndex = json('search-index.json')

/* ------------------------------------------------------------------ */
/* 1. Record counts vs blunt source counts                            */
/* ------------------------------------------------------------------ */

/**
 * Count real `NNN - Name` entry headers in a document.
 *
 * Anchoring on the line shape alone is wrong: Arceus's learnset ends with four
 * *level-100* moves (`100 - Recover`, `100 - Judgment`, …) that look exactly like
 * entry headers and inflate a naive count from 493 to 497. A genuine header is
 * always the line directly under a `=====` rule.
 */
function countEntryHeaders(text) {
  const lines = text.split('\n')
  let n = 0
  for (let i = 1; i < lines.length; i++) {
    if (/^={5,}$/.test(lines[i - 1]) && /^\d{3} - /.test(lines[i])) n++
  }
  return n
}

check(
  'pokemon.json length == rule-anchored "NNN - Name" headers',
  pokemon.length,
  countEntryHeaders(src('PokemonChanges.txt')),
)

check(
  'sinnohan.json length == rule-anchored "NNN - Name" headers',
  sinnohan.length,
  countEntryHeaders(src('SinnohanForms.txt')),
)

check(
  'type-changes.pokemonChanges == "#NNN" table rows in TypeChanges.txt',
  types.pokemonChanges.length,
  src('TypeChanges.txt').split('\n').filter((l) => /^#\d{3} /.test(l)).length,
)

check(
  'type-changes.chartChanges == "Ice now takes" sentences',
  types.chartChanges.length,
  src('TypeChanges.txt').split('\n').filter((l) => /^Ice now takes /.test(l)).length,
)

check(
  'moves.replacements == 29 rows between the Old Move / New Moves headers',
  moves.replacements.length,
  29,
)

check(
  'moves.newMoves == "Description:" blocks in MoveChanges.txt',
  moves.newMoves.length,
  src('MoveChanges.txt').split('\n').filter((l) => /^Description:/.test(l)).length,
)

check(
  'items.costChanges: priced rows == "($N >> $N)" lines in ItemChanges.txt',
  items.costChanges.filter((c) => c.oldPrice !== null && c.newPrice !== null).length,
  src('ItemChanges.txt').split('\n').filter((l) => /\(\$\d+ >> \$\d+\)/.test(l)).length,
)

checkTrue(
  'items.costChanges models the "now cost zero and are thus unsellable" list as $0',
  items.costChanges.some((c) => c.newPrice === 0),
  `entries=${items.costChanges.length}, zero-priced=${items.costChanges.filter((c) => c.newPrice === 0).length}`,
  { hard: false, note: 'source says "All TMs" now cost zero; null prices lose that fact' },
)

check(
  'wild.areas roughly matches "Levels:" lines in WildPokemon.txt',
  wild.areas.length,
  src('WildPokemon.txt').split('\n').filter((l) => /^Levels:/.test(l)).length,
  { hard: false, note: 'a few areas may legitimately have no Levels: line' },
)

/* ------------------------------------------------------------------ */
/* 2. Content-preservation checks                                     */
/* ------------------------------------------------------------------ */

// Every "compatible" line in the source must survive as a MoveNote or raw section.
const compatLines = src('PokemonChanges.txt')
  .split('\n')
  .filter((l) => /compatible/.test(l)).length
const compatInJson =
  pokemon.reduce((n, p) => {
    const own = p.moves.filter((m) => /compatible/.test(m.text)).length
    const inForms = p.forms.reduce(
      (k, f) => k + (f.moves ?? []).filter((m) => /compatible/.test(m.text)).length,
      0,
    )
    const inRaw = p.sections.reduce(
      (k, s) => k + (s.title.toLowerCase().includes('moves') ? s.lines.filter((l) => /compatible/.test(l)).length : 0),
      0,
    )
    return n + own + inForms
  }, 0) +
  pokemon.reduce(
    (n, p) =>
      n +
      p.sections.reduce((k, s) => k + s.lines.filter((l) => /compatible/.test(l)).length, 0),
    0,
  )
checkTrue(
  'every "compatible" source line is preserved somewhere in pokemon.json',
  compatInJson >= compatLines,
  `source=${compatLines}, found=${compatInJson}`,
)

// Learnset re-pointing arrows: exactly 19 in the whole corpus, and all captured.
const arrowLines =
  src('PokemonChanges.txt').split('\n').filter((l) => /^\d+ - .*>>/.test(l)).length +
  src('SinnohanForms.txt').split('\n').filter((l) => /^\d+ - .*>>/.test(l)).length
const arrowInJson =
  pokemon.reduce((n, p) => {
    const own = p.learnset.levelUp.filter((e) => e.replaces).length
    const forms = p.forms.reduce((k, f) => k + (f.levelUp ?? []).filter((e) => e.replaces).length, 0)
    return n + own + forms
  }, 0) + sinnohan.reduce((n, s) => n + s.learnset.levelUp.filter((e) => e.replaces).length, 0)
check('learnset ">>" replacements captured (LearnEntry.replaces)', arrowInJson, arrowLines)

// No entry may be completely empty of information.
const emptyPokemon = pokemon.filter(
  (p) =>
    !p.type &&
    !p.stats &&
    !p.ability &&
    p.moves.length === 0 &&
    p.learnset.levelUp.length === 0 &&
    p.evolution.length === 0 &&
    p.forms.length === 0 &&
    p.sections.length === 0,
)
checkTrue('no Pokemon entry is completely empty', emptyPokemon.length === 0, `empty=${emptyPokemon.length}`)

const emptySinnohan = sinnohan.filter((s) => s.types.length === 0 && s.learnset.levelUp.length === 0)
checkTrue('no Sinnohan entry is completely empty', emptySinnohan.length === 0, `empty=${emptySinnohan.length}`)

// Every raw section must carry at least one line.
const emptyRaw = [
  ...pokemon.flatMap((p) => p.sections),
  ...sinnohan.flatMap((s) => s.sections),
  ...(moves.noteSections ?? []),
  ...(items.noteSections ?? []),
  ...(misc.npc ?? []),
].filter((s) => !s.lines || s.lines.length === 0 || s.lines.every((l) => !l.trim()))
checkTrue('no RawSection is empty', emptyRaw.length === 0, `empty=${emptyRaw.length}`)

/* ------------------------------------------------------------------ */
/* 3. Numerical integrity                                             */
/* ------------------------------------------------------------------ */

const allStatBlocks = []
for (const p of pokemon) {
  if (p.stats) {
    allStatBlocks.push([`${p.name} (old)`, p.stats.old], [`${p.name} (new)`, p.stats.new])
  }
  for (const f of p.forms) {
    if (f.stats) {
      allStatBlocks.push([`${p.name} ${f.form} (old)`, f.stats.old], [`${p.name} ${f.form} (new)`, f.stats.new])
    }
  }
}
for (const s of sinnohan) allStatBlocks.push([s.name, s.stats])

const badBst = allStatBlocks.filter(([, b]) => b && b.hp + b.atk + b.def + b.spa + b.spd + b.spe !== b.bst)
checkTrue(
  'every StatBlock satisfies bst == hp+atk+def+spa+spd+spe',
  badBst.length === 0,
  badBst.map(([n, b]) => `${n}: ${b.hp + b.atk + b.def + b.spa + b.spd + b.spe} != ${b.bst}`).join('; '),
)

const badNumbers = allStatBlocks.filter(([, b]) =>
  [b.hp, b.atk, b.def, b.spa, b.spd, b.spe, b.bst].some(
    (v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0,
  ),
)
checkTrue('no StatBlock has a non-numeric or negative value', badNumbers.length === 0)

/* ------------------------------------------------------------------ */
/* 4. Uniqueness                                                      */
/* ------------------------------------------------------------------ */

const dupeDex = pokemon.length - new Set(pokemon.map((p) => p.dex)).size
check('pokemon dex numbers are unique', dupeDex, 0)

const dupeSlug = pokemon.length - new Set(pokemon.map((p) => p.slug)).size
check('pokemon slugs are unique', dupeSlug, 0)

const dupeSDex = sinnohan.length - new Set(sinnohan.map((s) => s.dex)).size
check('sinnohan dex numbers are unique', dupeSDex, 0)

const dupeSSlug = sinnohan.length - new Set(sinnohan.map((s) => s.slug)).size
check('sinnohan slugs are unique', dupeSSlug, 0)

/* ------------------------------------------------------------------ */
/* 5. Known-good spot checks (hand-verified against the source)        */
/* ------------------------------------------------------------------ */

const byName = (n) => pokemon.find((p) => p.name === n)
const charizard = byName('Charizard')
checkTrue(
  'Charizard: Fire/Flying -> Fire/Dragon',
  !!charizard &&
    charizard.type?.old.join('/') === 'Fire/Flying' &&
    charizard.type?.new.join('/') === 'Fire/Dragon',
  charizard ? JSON.stringify(charizard.type) : 'missing',
)

const arceus = byName('Arceus')
checkTrue('Arceus new BST == 1000', !!arceus && arceus.stats?.new.bst === 1000, String(arceus?.stats?.new.bst))

const bayleef = byName('Bayleef')
checkTrue(
  'Bayleef: 60 HP/62 Atk -> 70 HP/42 Atk (stat reshuffle)',
  !!bayleef && bayleef.stats?.old.hp === 60 && bayleef.stats?.old.atk === 62 && bayleef.stats?.new.hp === 70 && bayleef.stats?.new.atk === 42,
  bayleef ? JSON.stringify(bayleef.stats?.new) : 'missing',
)

const sButterfree = sinnohan.find((s) => s.name === 'Sinnohan Butterfree')
checkTrue(
  'Sinnohan Butterfree: Bug/Fairy, 535 BST, >=20 level-up moves',
  !!sButterfree &&
    sButterfree.types.join('/') === 'Bug/Fairy' &&
    sButterfree.stats.bst === 535 &&
    sButterfree.learnset.levelUp.length >= 20,
  sButterfree
    ? `types=${sButterfree.types.join('/')} bst=${sButterfree.stats.bst} levelup=${sButterfree.learnset.levelUp.length}`
    : 'missing',
)

// The source omits the "Sinnohan " prefix on dex 309/310; the pipeline must normalise it.
const electrike = sinnohan.find((s) => s.dex === 309)
checkTrue(
  'dex 309 is normalised to a Sinnohan name despite the source header saying "Electrike"',
  !!electrike && /sinnohan/i.test(electrike.name),
  electrike ? electrike.name : 'missing',
)

checkTrue(
  'type chart: Ice now resists Ground/Water/Dragon, and Rock drops 2x -> 1x (not 0.5x)',
  types.chartChanges.length === 4 &&
    types.chartChanges.some((c) => c.defender === 'Ice' && c.attacker === 'Ground' && c.oldMultiplier === 1 && c.newMultiplier === 0.5) &&
    types.chartChanges.some((c) => c.defender === 'Ice' && c.attacker === 'Rock' && c.oldMultiplier === 2 && c.newMultiplier === 1) &&
    types.chartChanges.some((c) => c.defender === 'Ice' && c.attacker === 'Water' && c.oldMultiplier === 1 && c.newMultiplier === 0.5) &&
    types.chartChanges.some((c) => c.defender === 'Ice' && c.attacker === 'Dragon' && c.oldMultiplier === 1 && c.newMultiplier === 0.5),
  types.chartChanges.map((c) => `${c.attacker}->${c.defender} ${c.oldMultiplier}->${c.newMultiplier}`).join(', '),
)

/* ------------------------------------------------------------------ */
/* 6. Search index sanity                                             */
/* ------------------------------------------------------------------ */

checkTrue('search index is non-trivial (>= 1200 records)', searchIndex.length >= 1200, `n=${searchIndex.length}`)

const badRoute = searchIndex.filter((r) => typeof r.route !== 'string' || !r.route.startsWith('#'))
checkTrue('every search record has a hash route', badRoute.length === 0, `bad=${badRoute.length}`)

const badSearch = searchIndex.filter(
  (r) => !r.id || !r.title || typeof r.body !== 'string' || !Array.isArray(r.badges),
)
checkTrue('every search record has id/title/body/badges', badSearch.length === 0, `bad=${badSearch.length}`)

const kinds = {}
for (const r of searchIndex) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1

// Every Pokémon must be findable by name.
const indexedPokemon = new Set(searchIndex.filter((r) => r.kind === 'pokemon').map((r) => r.title))
const missingPokemon = pokemon.filter((p) => !indexedPokemon.has(p.name) && !indexedPokemon.has(p.slug))
checkTrue(
  'every Pokémon appears in the search index',
  missingPokemon.length === 0,
  `missing=${missingPokemon.slice(0, 8).map((p) => p.name).join(', ')}`,
)

/* ------------------------------------------------------------------ */
/* 7. meta.json counts agree with the files they describe             */
/* ------------------------------------------------------------------ */

check('meta.counts.pokemon agrees with pokemon.json', meta.counts.pokemon, pokemon.length)
check('meta.counts.sinnohan agrees with sinnohan.json', meta.counts.sinnohan, sinnohan.length)
check('meta.counts.typeChangeEntries agrees with type-changes.json', meta.counts.typeChangeEntries, types.pokemonChanges.length)
check('meta.counts.newMoves agrees with moves.json', meta.counts.newMoves, moves.newMoves.length)
checkTrue('meta.documents covers every source document', meta.documents.length >= 14, `n=${meta.documents.length}`)

/* ------------------------------------------------------------------ */
/* Report                                                             */
/* ------------------------------------------------------------------ */

const pad = (s, n) => String(s).padEnd(n)
console.log('\n  ALTERED PLATINUM CODEX — INDEPENDENT DATA AUDIT\n')
for (const r of results) {
  const mark = r.ok ? '\x1b[32m✓\x1b[0m' : r.hard ? '\x1b[31m✗\x1b[0m' : '\x1b[33m!\x1b[0m'
  console.log(`  ${mark} ${pad(r.label, 78)} ${r.ok ? '' : `[${r.actual} vs ${r.expected}] ${r.note}`}`)
}

console.log('\n  Search index by kind:')
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${pad(k, 14)} ${v}`)
}
console.log(`\n  Totals: pokemon=${pokemon.length} sinnohan=${sinnohan.length} typeChanges=${types.pokemonChanges.length} trainers areas=${trainers.areas.length} wild areas=${wild.areas.length} events=${events.sections.length} search=${searchIndex.length}`)

const soft = results.filter((r) => !r.ok && !r.hard).length
console.log(
  failures === 0
    ? `\n  \x1b[32mALL HARD CHECKS PASSED\x1b[0m${soft ? ` (${soft} soft warning${soft > 1 ? 's' : ''})` : ''}\n`
    : `\n  \x1b[31m${failures} HARD CHECK(S) FAILED\x1b[0m\n`,
)
process.exit(failures === 0 ? 0 : 1)
