#!/usr/bin/env node
/**
 * fetch-baseline.mjs — build the vanilla Platinum baseline cache.
 *
 * Fetches the PokeAPI data the codex needs to fill the gaps the hack's
 * documents leave (base stats, TM/HM lists, move-tutor lists, level-up lists)
 * and caches every response verbatim under `.cache/pokeapi/` (git-ignored), so
 * that this script and `build-data.mjs` are completely offline afterwards.
 *
 * Usage:
 *   node scripts/fetch-baseline.mjs            # fetch what is missing
 *   node scripts/fetch-baseline.mjs --force    # re-fetch everything
 *   node scripts/fetch-baseline.mjs --offline  # re-project from the cache only
 *
 * Exit code 0 = cache complete, 1 = at least one item could not be resolved.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  BASELINE_SOURCE,
  BASELINE_URL,
  FORM_SLUGS,
  POKEMON_MAX_DEX,
  TM_HM_ITEMS,
  buildDerived,
  cacheRoot,
  derivedPath,
  extractBaseline,
  extractForm,
  fetchBaseline,
  hasCache,
  manifestPath,
  readCache,
  readManifest,
} from './lib/baseline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const OFFLINE = args.has('--offline')

const pad = (value, width) => String(value).padEnd(width)
const num = (value) => String(value).padStart(8)

/** A tiny in-place progress line so a 1–2 minute download is not a black box. */
function progressPrinter() {
  let last = 0
  return (done, total, label) => {
    const now = Date.now()
    if (now - last < 400 && done !== total) return
    last = now
    const width = 28
    const filled = Math.round((done / total) * width)
    process.stdout.write(
      `\r  fetching ${pad(label, 8)} [${'#'.repeat(filled)}${'.'.repeat(width - filled)}] ${done}/${total}`,
    )
    if (done === total) process.stdout.write('\n')
  }
}

/** Re-project the cache without any network access. */
function offlineRun(dir) {
  const { derived, missingPokemon, missingForms } = buildDerived(dir)
  if (missingPokemon.length) {
    console.error(
      `  ! offline mode: ${missingPokemon.length} pokemon responses missing from the cache ` +
        `(first: ${missingPokemon.slice(0, 5).join(', ')}) — run once without --offline first.`,
    )
    process.exit(1)
  }
  fs.writeFileSync(derivedPath(dir), `${JSON.stringify(derived)}\n`, 'utf8')
  return {
    dir,
    fetchedAt: readManifest(dir)?.fetchedAt ?? 'unknown',
    tally: {
      cached: Array.from({ length: POKEMON_MAX_DEX }, (_, i) => i + 1).filter((dex) =>
        hasCache(dir, 'pokemon', dex),
      ).length,
      fetched: 0,
      failed: [],
      missingPokemon: [],
      tmSlots: Object.keys(derived.tmTable.slots).length,
      tmMissing: derived.tmTable.missing,
      moveNames: Object.keys(derived.moveNames).length,
      moveNamesUnresolved: derived.unresolvedMoveNames,
      formSlugs: FORM_SLUGS.length,
      formsMissing: missingForms,
      formsFailed: [],
    },
  }
}

async function main() {
  const dir = cacheRoot(ROOT)
  console.log('')
  console.log('Pokémon Altered Platinum — vanilla Platinum baseline')
  console.log('='.repeat(78))
  console.log('')
  console.log(`  source      ${BASELINE_SOURCE}`)
  console.log(`  endpoint    ${BASELINE_URL}`)
  console.log(`  cache       ${path.relative(ROOT, dir)}/`)
  console.log('')

  const result = OFFLINE
    ? offlineRun(dir)
    : await fetchBaseline({ root: ROOT, force: FORCE, onProgress: progressPrinter() })

  const { tally } = result
  const tmTotal = TM_HM_ITEMS.length

  console.log('')
  console.log('TALLY')
  console.log(`  ${pad('pokemon responses', 34)} ${num(POKEMON_MAX_DEX - tally.missingPokemon.length)} / ${POKEMON_MAX_DEX}`)
  console.log(`  ${pad('  already cached', 34)} ${num(tally.cached)}`)
  console.log(`  ${pad('  downloaded this run', 34)} ${num(tally.fetched)}`)
  console.log(`  ${pad('TM/HM slots resolved', 34)} ${num(tally.tmSlots)} / ${tmTotal}`)
  console.log(
    `  ${pad('  slots PokeAPI cannot resolve', 34)} ${num(tally.tmMissing.length)}` +
      (tally.tmMissing.length ? ` (${tally.tmMissing.join(', ')})` : ''),
  )
  console.log(`  ${pad('English move names', 34)} ${num(tally.moveNames)}`)
  console.log(
    `  ${pad('  names PokeAPI cannot resolve', 34)} ${num(tally.moveNamesUnresolved.length)}` +
      (tally.moveNamesUnresolved.length ? ` (${tally.moveNamesUnresolved.slice(0, 8).join(', ')})` : ''),
  )
  console.log(`  ${pad('alternate-form typings', 34)} ${num(tally.formSlugs - tally.formsMissing.length)} / ${tally.formSlugs}`)
  if (tally.formsMissing.length) {
    console.log(`  ${pad('  forms PokeAPI cannot resolve', 34)} ${num(tally.formsMissing.length)} (${tally.formsMissing.slice(0, 8).join(', ')})`)
  }
  console.log(`  ${pad('failed requests', 34)} ${num(tally.failed.length)}`)
  for (const failure of tally.failed.slice(0, 10)) console.log(`        ! ${failure}`)
  console.log(`  ${pad('fetchedAt', 34)} ${result.fetchedAt}`)

  // A one-Pokémon sanity read, straight from the cache.
  const sample = readCache(dir, 'pokemon', 6)
  if (sample) {
    const extracted = extractBaseline(sample)
    console.log('')
    console.log('SAMPLE — dex 006 (Charizard)')
    console.log(`  stats        ${extracted.stats.hp}/${extracted.stats.atk}/${extracted.stats.def}/${extracted.stats.spa}/${extracted.stats.spd}/${extracted.stats.spe} (BST ${extracted.stats.bst})`)
    console.log(`  types        ${extracted.types.join(' / ')} (Gen IV)`)
    console.log(`  level-up     ${extracted.levelUp.length} move(s)`)
    console.log(`  TM/HM        ${extracted.machine.length} machine(s)`)
    console.log(`  move tutor   ${extracted.tutor.length} move(s)`)
  }

  // Alternate forms — the second thing the documents cannot provide.
  const rotomForm = readCache(dir, 'form', 'rotom-fan')
  if (rotomForm) {
    const form = extractForm(rotomForm)
    console.log('')
    console.log('SAMPLE — form rotom-fan')
    console.log(`  name         ${form.name}`)
    console.log(`  types        ${form.types.join(' / ')}`)
  }

  console.log('')
  console.log(`  derived projection  ${path.relative(ROOT, derivedPath(dir))}`)
  console.log(`  manifest            ${path.relative(ROOT, manifestPath(dir))}`)

  const failures = tally.failed.length + tally.missingPokemon.length + tally.tmMissing.length + tally.formsMissing.length
  console.log('')
  if (failures) {
    console.log(`FETCH INCOMPLETE — ${failures} item(s) unresolved; re-run to retry the missing ones.`)
    console.log('')
    process.exit(1)
  }
  console.log('BASELINE READY — the build is now fully offline.')
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`FETCH FAILED — ${error.message}`)
  console.error('')
  process.exit(1)
})
