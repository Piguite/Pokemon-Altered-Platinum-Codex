/**
 * wild.mjs — parser for `WildPokemon.txt`.
 *
 * Area layout (the rule *follows* the header, unlike the trainer document):
 *
 *   Twinleaf Town
 *   Levels: 4 - 5 (Fishing), 20 - 40 (Surfing)
 *   ===================
 *   Surf        Psyduck (90%), Golduck (10%)
 *
 * Quirks handled here: the level label may be `Levels:`, `Wild Levels:` or
 * `Level:` (and is missing entirely for one `Turnback Cave` block); a few lines
 * are tab-separated instead of space-separated; one line in `Route 204 ~ South`
 * runs two methods together with no separator; and a slot list may omit a comma.
 */

import { bulletLines, collapse, isRule, splitRuleSections } from './text.mjs'

/** `4 - 5 (Fishing)` / `30 - 45 (Surf)` — used to identify the header line. */
const LEVELS = /^(?:Wild )?Levels?:\s*(.*)$/

/** A `Species (NN%)` slot, tolerant of a missing separator before it. */
const SLOT = /([^,]*?)\s*\(\s*(\d+)%\s*\)/g

/**
 * `...)Poké Radar  Gloom (22%)` — a stray concatenation with no space at all.
 * Split it after the `%)` when the next character starts a new capitalised word.
 */
function splitConcatenated(line) {
  return line.split(/(?<=\d%\))(?=[A-ZÀ-Þ])/)
}

/**
 * Parse one `Method   Species (NN%), Species (NN%)` line.
 *
 * The method is separated from the slot list by a run of 2+ spaces (or a tab);
 * locating that separator first avoids the greedy trap where a species regex
 * would otherwise swallow the method name too.
 */
function parseEncounterLine(raw, log, file) {
  const tabular = raw.replace(/\t/g, '    ').trimEnd()
  const split = tabular.match(/^(\S.*?)\s{2,}(\S.*)$/)
  if (!split) return null
  const method = collapse(split[1])
  const rest = collapse(split[2])
  if (!method) return null
  // `Poké Radar  -` explicitly states that the method yields nothing here.
  if (/^-+$/.test(rest)) return { method, slots: [] }

  const slots = []
  SLOT.lastIndex = 0
  let m
  while ((m = SLOT.exec(rest)) !== null) {
    const rawSpecies = m[1].replace(/^[\s,]+/, '').trim()
    if (!rawSpecies) continue
    const isSinnohan = /\(S\)$/.test(rawSpecies)
    slots.push({
      species: rawSpecies.replace(/\s*\(S\)$/, '').trim(),
      percent: Number(m[2]),
      isSinnohan,
    })
  }
  if (!slots.length) {
    log.unparsedLine(file, raw, 'encounter line without any `Species (NN%)` slot')
    return null
  }
  return { method, slots }
}

/** Parse `WildPokemon.txt` into a `WildDoc`. */
export function parseWildPokemon(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  const doc = { generalNotes: [], areas: [] }
  let areaBody = null

  for (const section of sections) {
    if (collapse(section.title) === 'Area Changes') areaBody = section.body
    else doc.generalNotes.push(...bulletLines(section.body))
  }

  if (!areaBody) {
    log.unparsedLine(file, 'Area Changes', 'the `Area Changes` section was not found')
    return doc
  }

  let area = null
  for (let i = 0; i < areaBody.length; i++) {
    const raw = areaBody[i]
    const t = collapse(raw)
    if (!t) continue
    // Area rules separate the header from the encounter list.
    if (isRule(raw)) continue

    // Area header: `Name` [+ `Levels: ...`] immediately followed by the rule.
    const next = collapse(areaBody[i + 1] ?? '')
    if (isRule(next)) {
      area = { area: t, levels: '', methods: [] }
      doc.areas.push(area)
      continue
    }
    const levels = next.match(LEVELS)
    if (levels && isRule(collapse(areaBody[i + 2] ?? ''))) {
      area = { area: t, levels: levels[1].trim(), methods: [] }
      doc.areas.push(area)
      i++ // consume the level line
      continue
    }

    if (!area) {
      log.unparsedLine(file, raw, 'line before the first area heading')
      continue
    }

    // A placeholder dash means "no encounters listed for this method".
    if (/^-+$/.test(t)) {
      log.unparsedLine(file, raw, 'placeholder `-` (no encounters listed)')
      continue
    }

    for (const part of splitConcatenated(raw)) {
      const parsed = parseEncounterLine(part, log, file)
      if (parsed) {
        area.methods.push(parsed)
        continue
      }
      log.unparsedLine(file, part, 'wild line that is not `Method   Species (NN%)`')
    }
  }

  disambiguateDuplicateAreas(doc, log)

  return doc
}

/**
 * Make every area name addressable.
 *
 * `WildPokemon.txt` documents **Turnback Cave twice**, with two genuinely
 * different tables (one with no level line and a 6-species spread, one at
 * `Lv. 65 - 66` with 8 species including Sinnohan Lunatone/Solrock). Left alone,
 * both areas share the name `Turnback Cave`, so `?area=Turnback Cave` can only
 * ever reach the first one and the second becomes unreachable — a documented
 * encounter table a reader can never see.
 *
 * The suffix comes from the source's own `Levels`/`Level` line, so nothing is
 * invented; only names that actually collide are touched.
 */
function disambiguateDuplicateAreas(doc, log) {
  const counts = new Map()
  for (const area of doc.areas) counts.set(area.area, (counts.get(area.area) ?? 0) + 1)
  const duplicates = new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name))
  if (duplicates.size === 0) return

  const seen = new Map()
  for (const area of doc.areas) {
    if (!duplicates.has(area.area)) continue
    const index = (seen.get(area.area) ?? 0) + 1
    seen.set(area.area, index)

    const original = area.area
    /*
     * The level range is the only discriminator the document itself provides.
     * Strip the method annotation so the suffix reads `(Lv. 65 - 66)` rather
     * than the awkward `(Lv. 65 - 66 (Walking))`.
     */
    const range = area.levels.split(',')[0].replace(/\([^)]*\)/g, '').trim()
    area.area = range ? `${original} (Lv. ${range})` : `${original} (${index})`
    // A suffixed name must still be unique; fall back to the ordinal.
    if (doc.areas.filter((other) => other.area === area.area).length > 1) {
      area.area = `${original} (${index})`
    }

    log.warn(
      `WildPokemon.txt documents "${original}" more than once; entry ${index} is exposed as ` +
        `"${area.area}" so both tables stay reachable`,
    )
  }
}
