#!/usr/bin/env node
/**
 * fetch-sprites.mjs — download the PokeAPI sprites used by the codex.
 *
 *   node scripts/fetch-sprites.mjs                      # dex 1..493 into public/sprites
 *   node scripts/fetch-sprites.mjs 1 151                # explicit range
 *   node scripts/fetch-sprites.mjs --source=raw         # CDN only
 *   node scripts/fetch-sprites.mjs --concurrency=3 --delay=120 --timeout=8000
 *
 * Sources (tried in order until one succeeds)
 *  - `jsdelivr` (primary): `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/<dex>.png`
 *    — the same repository over a CDN that does not throttle bursts.
 *  - `raw` (fallback):
 *    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/<dex>.png`
 *    — reliable for the first few hundred requests, then it stalls; aborts after `--timeout`.
 *  - `api` (last resort):
 *    `https://api.github.com/repos/PokeAPI/sprites/contents/sprites/pokemon/<dex>.png`,
 *    which returns the *same blob* base64-encoded — verified byte-identical
 *    (`md5sum`) against files fetched from the CDN. It is limited to 60
 *    requests/hour for unauthenticated callers, so the fallback stops as soon
 *    as GitHub reports no quota left.
 *
 * Idempotent: a sprite that already exists and is non-empty is skipped, so
 * re-running after a partial download only fetches what is missing. Downloads
 * run through a small concurrency pool and every failure is retried twice
 * before it is reported.
 *
 * The hack's own custom sprites are not redistributable, which is why the
 * origins are used for Sinnohan forms too — the UI must render those with an
 * `S` badge (`docs/DATA-SCHEMA.md`, "Sprites").
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public', 'sprites')

const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'
const RAW_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const API_BASE = 'https://api.github.com/repos/PokeAPI/sprites/contents/sprites/pokemon'

const SOURCE_NAMES = ['jsdelivr', 'raw', 'api']
const DEFAULT_TIMEOUT_MS = 20_000

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const match = argv.find((a) => a.startsWith(`--${name}=`))
  return match ? match.split('=')[1] : fallback
}
const positional = argv.filter((a) => !a.startsWith('--'))

const CONCURRENCY = Number.parseInt(flag('concurrency', '6'), 10)
const RETRIES = Number.parseInt(flag('retries', '2'), 10)
const DELAY = Number.parseInt(flag('delay', '0'), 10)
const SOURCE = flag('source', 'auto') // auto | jsdelivr | raw | api
const TIMEOUT_MS = Number.parseInt(flag('timeout', String(DEFAULT_TIMEOUT_MS)), 10)

const FROM = Number.parseInt(positional[0] ?? '1', 10)
const TO = Number.parseInt(positional[1] ?? '493', 10)

if (!Number.isInteger(FROM) || !Number.isInteger(TO) || FROM < 1 || TO < FROM) {
  console.error(`Usage: node scripts/fetch-sprites.mjs [from] [to]   (got ${positional.join(' ')})`)
  process.exit(1)
}
if (!['auto', ...SOURCE_NAMES].includes(SOURCE)) {
  console.error(`--source must be one of auto|${SOURCE_NAMES.join('|')} (got ${SOURCE})`)
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* Downloading                                                         */
/* ------------------------------------------------------------------ */

/** Remaining GitHub API quota, learned from the response headers. */
let apiQuota = Number.POSITIVE_INFINITY

/** A file counts as present only when it exists and holds bytes. */
function alreadyPresent(file) {
  try {
    return fs.statSync(file).size > 0
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Fetch the sprite bytes from one source; throws on failure. */
async function attempt(dex, source) {
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  if (source === 'jsdelivr') {
    const response = await fetch(`${JSDELIVR_BASE}/${dex}.png`, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) throw new Error('empty response body')
    return buffer
  }

  if (source === 'raw') {
    const response = await fetch(`${RAW_BASE}/${dex}.png`, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) throw new Error('empty response body')
    return buffer
  }

  const response = await fetch(`${API_BASE}/${dex}.png`, {
    signal,
    headers: { accept: 'application/vnd.github+json' },
  })
  const remaining = response.headers.get('x-ratelimit-remaining')
  if (remaining !== null) apiQuota = Number.parseInt(remaining, 10)
  if (!response.ok) throw new Error(`HTTP ${response.status}${response.status === 403 ? ' (rate limited?)' : ''}`)
  const payload = await response.json()
  const buffer = Buffer.from(payload.content ?? '', 'base64')
  if (buffer.length === 0) throw new Error('empty response body')
  return buffer
}

/**
 * Source order. jsDelivr leads because `raw.githubusercontent.com` throttles hard
 * after a few hundred requests in a short window and then stalls rather than
 * erroring (observed: requests hang until the 20 s abort).
 */
const SOURCE_ORDER = SOURCE === 'auto' ? SOURCE_NAMES : [SOURCE]

/** Download one sprite with retries and fallback; returns a result record. */
async function fetchSprite(dex) {
  const file = path.join(OUT_DIR, `${dex}.png`)
  if (alreadyPresent(file)) return { dex, status: 'skipped' }

  let lastError = null

  for (const source of SOURCE_ORDER) {
    for (let tryIndex = 0; tryIndex <= RETRIES; tryIndex++) {
      if (source === 'api' && apiQuota <= 0) break
      try {
        if (DELAY > 0) await sleep(DELAY)
        const buffer = await attempt(dex, source)
        // Write to a temporary file first so an interrupted run never leaves a
        // truncated sprite that a later run would consider complete.
        const tmp = `${file}.tmp`
        fs.writeFileSync(tmp, buffer)
        fs.renameSync(tmp, file)
        return { dex, status: 'downloaded', bytes: buffer.length, source }
      } catch (error) {
        lastError = error
        // Back off harder on connection resets, which is what a rate-limiting
        // CDN or proxy produces.
        if (tryIndex < RETRIES) await sleep(1000 * 2 ** tryIndex * (tryIndex + 1))
      }
    }
  }

  const cause = lastError?.cause?.code ?? lastError?.cause?.message
  return { dex, status: 'failed', error: `${lastError?.message ?? 'unknown error'}${cause ? ` (${cause})` : ''}` }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const dexs = []
  for (let dex = FROM; dex <= TO; dex++) dexs.push(dex)

  const stats = { downloaded: 0, skipped: 0, failed: 0 }
  const bySource = { jsdelivr: 0, raw: 0, api: 0 }
  const failures = []
  let downloadedBytes = 0
  let skippedBytes = 0

  let cursor = 0
  const worker = async () => {
    for (;;) {
      const index = cursor++
      if (index >= dexs.length) return
      const dex = dexs[index]
      const result = await fetchSprite(dex)
      stats[result.status]++
      if (result.status === 'downloaded') {
        bySource[result.source]++
        downloadedBytes += result.bytes ?? 0
        process.stdout.write('.')
      } else if (result.status === 'skipped') {
        skippedBytes += fs.statSync(path.join(OUT_DIR, `${dex}.png`)).size
        process.stdout.write('=')
      } else {
        failures.push(result)
        process.stdout.write('x')
      }
      if (index % 50 === 49) process.stdout.write('\n')
    }
  }

  console.log(
    `Fetching sprites ${FROM}-${TO} into public/sprites ` +
      `(source ${SOURCE}, concurrency ${CONCURRENCY}, ${RETRIES} retries, ${DELAY} ms delay, ${TIMEOUT_MS} ms timeout)`,
  )
  console.log('  . = downloaded   = = skipped (already present)   x = failed')
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dexs.length) }, worker))
  if (dexs.length % 50 !== 0) process.stdout.write('\n')

  const onDisk = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png')).length
  const mb = (value) => `${(value / 1024 / 1024).toFixed(2)} MB`

  console.log('')
  console.log('SPRITE TALLY')
  console.log(`  requested  ${dexs.length}`)
  console.log(`  downloaded ${stats.downloaded} (${mb(downloadedBytes)}; jsdelivr ${bySource.jsdelivr}, raw ${bySource.raw}, api ${bySource.api})`)
  console.log(`  skipped    ${stats.skipped} (${mb(skippedBytes)} already on disk)`)
  console.log(`  failed     ${stats.failed}`)
  console.log(`  on disk    ${onDisk} PNG files in public/sprites`)

  if (failures.length) {
    console.log('')
    console.log('FAILURES')
    for (const failure of failures) console.log(`  ${failure.dex}: ${failure.error}`)
    if (apiQuota <= 0) {
      console.log('')
      console.log('  GitHub API quota exhausted — wait for it to reset (1 hour) and re-run;')
      console.log('  already-downloaded sprites are skipped, so the run resumes where it stopped.')
    }
    process.exit(1)
  }
}

await main()
