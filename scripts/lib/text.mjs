/**
 * text.mjs — shared primitives for the Altered Platinum data pipeline.
 *
 * The source documents are hand-written, fixed-width-ish text with CRLF line
 * endings, mixed tabs/spaces and inconsistent field labels. Everything in this
 * module is deliberately tolerant: it never throws on unexpected input, it
 * returns `null` instead so the caller can fall back to keeping the raw line.
 */

import fs from 'node:fs'

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Read a source file as an array of lines.
 *
 * CRLF is stripped FIRST — every anchor (`^...$`) in this pipeline silently
 * fails otherwise because the trailing `\r` is part of the line.
 * Trailing whitespace is removed as well: the sources contain lines that look
 * blank but actually hold a stray space (e.g. `"Stats: "`, or a line with a
 * single tab), which would otherwise be treated as content.
 */
export function readLines(absPath) {
  return fs
    .readFileSync(absPath, 'utf8')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
}

/** `true` for a run of `=` characters — the section rule used across the docs. */
export function isRule(line) {
  return /^=+$/.test(line.trim())
}

/** `true` for a run of `-` characters — the sub-section rule (`---`). */
export function isDashRule(line) {
  return /^-{2,}$/.test(line.trim())
}

/**
 * Collapse a line for prose / field parsing: tabs become spaces, runs of
 * spaces collapse to one, surrounding whitespace is trimmed.
 *
 * Only use this where column positions do not matter — `columns()` below
 * preserves the 2+ space separation the fixed-width tables rely on.
 */
export function collapse(line) {
  return line.replace(/\t/g, '    ').replace(/ {2,}/g, ' ').trim()
}

/**
 * Split a fixed-width table row into columns on runs of 2+ spaces (tabs are
 * widened first, so tab-separated rows split identically).
 */
export function columns(line) {
  return line
    .replace(/\t/g, '    ')
    .trimEnd()
    .split(/ {2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

/* ------------------------------------------------------------------ */
/* Bullets / markers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Strip a leading `- ` bullet marker.
 * The sources indent some bullets by a leading space (`LevelCaps.txt`).
 */
export function stripBullet(line) {
  return collapse(line).replace(/^-\s*/, '')
}

/** `true` when the (collapsed) line is a bullet. */
export function isBullet(line) {
  return /^-\s+/.test(collapse(line))
}

/**
 * Pull the trailing annotation markers off a move name / note text.
 *
 * Handles `(!!)` = "previously unavailable", `(PLA)` = "added via Legends:
 * Arceus", and records anything else (e.g. the stray `(1)` on Heracross's
 * Headlong Rush) as an unknown marker so the build can report it.
 *
 * `(!!)` may be glued to the name: `7 - Roughhouse(!!)`.
 */
export function splitMarkers(text) {
  let rest = text.trim()
  let isNew = false
  let source
  const unknown = []
  for (;;) {
    const m = rest.match(/(?:^|\s)\((!!|PLA|\d+)\)$/)
    if (!m) break
    if (m[1] === '!!') isNew = true
    else if (m[1] === 'PLA') source = 'PLA'
    else unknown.push(m[1])
    rest = rest.slice(0, m.index).trim()
  }
  return { text: rest, isNew, source, unknown }
}

/* ------------------------------------------------------------------ */
/* Stat blocks / type & ability lists                                  */
/* ------------------------------------------------------------------ */

const STAT_DETAIL = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SAtk'],
  ['spd', 'SDef'],
  ['spe', 'Spd'],
]

/**
 * Parse a single stat block. Two layouts exist in the sources:
 *
 *   78 HP / 84 Atk / 78 Def / 109 SAtk / 85 SDef / 100 Spd / 534 BST
 *   130, 110, 95, 65, 65, 60 - 525 BST        (Eevee's "All Evolutions" block)
 *
 * Returns `null` when the text is not a stat block.
 */
export function parseStatBlock(text) {
  const collapsed = collapse(text)

  const slash = collapsed.match(
    /^(\d+)\s*HP\s*\/\s*(\d+)\s*Atk\s*\/\s*(\d+)\s*Def\s*\/\s*(\d+)\s*SAtk\s*\/\s*(\d+)\s*SDef\s*\/\s*(\d+)\s*Spd\s*\/\s*(\d+)\s*BST$/i,
  )
  if (slash) {
    const n = slash.slice(1).map(Number)
    return { hp: n[0], atk: n[1], def: n[2], spa: n[3], spd: n[4], spe: n[5], bst: n[6] }
  }

  const commas = collapsed.match(
    /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*-\s*(\d+)\s*BST$/i,
  )
  if (commas) {
    const n = commas.slice(1).map(Number)
    return { hp: n[0], atk: n[1], def: n[2], spa: n[3], spd: n[4], spe: n[5], bst: n[6] }
  }

  return null
}

/** Sum of the six base stats of a StatBlock. */
export function statSum(stat) {
  return stat.hp + stat.atk + stat.def + stat.spa + stat.spd + stat.spe
}

/** `Fire / Flying` -> `["Fire", "Flying"]`. Preserves `???`. */
export function splitTypes(text) {
  return collapse(text)
    .split('/')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** `Chlorophyll / Overgrow` -> `["Chlorophyll", "Overgrow"]`. */
export function splitAbilities(text) {
  return splitTypes(text)
}

/* ------------------------------------------------------------------ */
/* Old / New pairs                                                     */
/* ------------------------------------------------------------------ */

/**
 * Read the `Old` / `New` (and the occasional `Vanilla`, or `New(Scope)`) lines
 * of a labelled section, preserving source order.
 *
 * Sources quirks handled here:
 *  - `Old: 100% M / 0% F` — the prefix may be followed by a colon.
 *  - `New(Plant Cloak)  Chlorophyll / Unaware` — scoped pairs (Wormadam).
 *  - `Vanilla 70 HP / ...` — Gulpin uses `Vanilla` instead of `Old`.
 *  - five entries (Volbeat, Sharpedo, Wailord, Camerupt, Grumpig) wrongly
 *    repeat `Old` where `New` was meant; the second line is reported through
 *    `duplicateOld` so the build can warn about it.
 */
export function readOldNew(lines) {
  const flat = []
  const scoped = []
  const others = []
  const prefix = /^(Old|New|Vanilla)\s*(?:\(([^)]*)\))?\s*:?\s*(.*)$/

  for (const line of lines) {
    const m = collapse(line).match(prefix)
    if (!m) {
      others.push(collapse(line))
      continue
    }
    const entry = { kind: m[1], value: m[3].trim(), raw: collapse(line) }
    if (m[2]) scoped.push({ ...entry, scope: m[2].trim() })
    else flat.push(entry)
  }

  const old = flat.find((e) => e.kind === 'Old' || e.kind === 'Vanilla') ?? null
  const newEntry = flat.find((e) => e !== old) ?? null
  const duplicateOld = Boolean(newEntry && (newEntry.kind === 'Old' || newEntry.kind === 'Vanilla'))
  const extra = flat.slice(2)

  return {
    old: old ? old.value : null,
    new: newEntry ? newEntry.value : null,
    duplicateOld,
    extra,
    scoped,
    others,
  }
}

/* ------------------------------------------------------------------ */
/* Section splitting                                                   */
/* ------------------------------------------------------------------ */

/**
 * Split lines into `rule / title / rule` sections.
 *
 * Every document in `data/source/` uses this shape:
 *
 *   ===================
 *   Title
 *   ===================
 *   body...
 *
 * The body runs until the next `rule / title / rule` triple, which makes the
 * splitter work at any nesting depth (the specific Pokémon entries use the very
 * same shape inside the outer prose sections).
 *
 * Returns `{ pre, sections }` where `pre` holds whatever came before the first
 * section so nothing is lost.
 */
export function splitRuleSections(lines) {
  const sections = []
  let i = 0
  let pre = []
  while (i < lines.length) {
    if (isRule(lines[i]) && lines[i + 1] !== undefined && !isRule(lines[i + 1]) && isRule(lines[i + 2] ?? '')) {
      const title = lines[i + 1].trim()
      let j = i + 3
      while (j < lines.length) {
        if (
          isRule(lines[j]) &&
          lines[j + 1] !== undefined &&
          !isRule(lines[j + 1]) &&
          isRule(lines[j + 2] ?? '')
        ) {
          break
        }
        j++
      }
      sections.push({ title, body: lines.slice(i + 3, j) })
      i = j
    } else {
      if (sections.length === 0) pre.push(lines[i])
      else sections[sections.length - 1].body.push(lines[i])
      i++
    }
  }
  if (sections.length === 0) pre = lines.slice()
  return { pre, sections }
}

/** Non-blank, collapsed body lines of a section (blank lines dropped). */
export function bodyLines(lines) {
  return lines.map(collapse).filter((l) => l.length > 0)
}

/**
 * `generalNotes` lines: like `bodyLines` but with the leading `- ` bullet
 * marker removed, because these feed a list the UI renders itself.
 */
export function bulletLines(lines) {
  return bodyLines(lines).map((l) => l.replace(/^-\s*/, ''))
}

/** Build a `RawSection` — title plus every non-blank body line, verbatim. */
export function rawSection(title, lines) {
  return { title, lines: bodyLines(lines) }
}

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

const SLUG_OVERRIDES = {
  '♂': '-m',
  '♀': '-f',
  é: 'e',
  É: 'e',
}

/**
 * Lowercase, URL-safe slug. `Nidoran♀` -> `nidoran-f`,
 * `Farfetch'd` -> `farfetchd`, `Mr. Mime` -> `mr-mime`.
 */
export function slugify(name) {
  return name
    .replace(/[♂♀éÉ]/g, (c) => SLUG_OVERRIDES[c])
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* ------------------------------------------------------------------ */
/* Build log                                                           */
/* ------------------------------------------------------------------ */

/**
 * Collects everything the build wants to report: unparsed lines (with a
 * bounded number of samples), soft warnings and statistics.
 */
export class BuildLog {
  constructor() {
    /** @type {Map<string, {count: number, samples: {line: number, text: string, reason: string}[]}>} */
    this.unparsed = new Map()
    /** @type {Map<string, Map<string, number>>} file -> collapsed line -> 1-based line number */
    this.lineIndex = new Map()
    this.warnings = []
    this.notes = []
  }

  /**
   * Register a file's lines so `unparsedLine` can report line numbers
   * without every parser having to thread them through.
   */
  registerFile(file, lines) {
    const index = new Map()
    lines.forEach((line, i) => {
      const key = collapse(line)
      if (key && !index.has(key)) index.set(key, i + 1)
    })
    this.lineIndex.set(file, index)
  }

  /**
   * Record a source line that did not map onto a typed field.
   * The line is still preserved in a `RawSection`; this only drives the
   * parse report, which needs the line number when one can be resolved.
   */
  unparsedLine(file, text, reason) {
    let bucket = this.unparsed.get(file)
    if (!bucket) {
      bucket = { count: 0, samples: [] }
      this.unparsed.set(file, bucket)
    }
    bucket.count++
    const line = this.lineIndex.get(file)?.get(collapse(text)) ?? 0
    if (bucket.samples.length < 12) bucket.samples.push({ line, text: collapse(text), reason })
  }

  /** Soft warning — printed, never fatal. */
  warn(message) {
    this.warnings.push(message)
  }

  /** Informational note for the parse report. */
  note(message) {
    this.notes.push(message)
  }

  get unparsedTotal() {
    let total = 0
    for (const bucket of this.unparsed.values()) total += bucket.count
    return total
  }

  perFile() {
    return [...this.unparsed.entries()]
      .map(([file, bucket]) => ({ file, count: bucket.count, samples: bucket.samples }))
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
  }
}

/* ------------------------------------------------------------------ */
/* Misc helpers                                                        */
/* ------------------------------------------------------------------ */

/** Stable sort by a string key (never mutates the input). */
export function sortBy(items, key) {
  return [...items].sort((a, b) => String(key(a)).localeCompare(String(key(b)), 'en'))
}

/** Split `A / B / C` style group headings into their members. */
export function splitGroup(name) {
  return name
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
}
