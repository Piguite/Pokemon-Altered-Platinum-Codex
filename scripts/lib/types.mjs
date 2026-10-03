/**
 * types.mjs — parser for `TypeChanges.txt`.
 *
 * The document contains the Ice type-chart rework (four sentences plus their
 * rationale paragraphs) and the 69 Pokémon type changes (a four-column table
 * that is tab-separated on some rows and space-separated on others).
 */

import { bulletLines, collapse, columns, splitRuleSections, splitTypes } from './text.mjs'

/**
 * Vanilla (Platinum) multipliers for the four cells the hack touches.
 * Ground -> Ice is 1x, every other relation listed here is the default 1x
 * except Rock -> Ice which is 2x. Anything not listed defaults to 1.
 */
const VANILLA_CHART = {
  'Rock>Ice': 2,
}

/** `Ice now takes 0.5x from Ground.` -> `{ attacker, defender, newMultiplier }`. */
function parseChartSentence(text) {
  const m = collapse(text).match(/^Ice now takes ([\d.]+)x from ([A-Za-z]+)\.?$/)
  if (!m) return null
  const attacker = m[2]
  return {
    attacker,
    defender: 'Ice',
    oldMultiplier: VANILLA_CHART[`${attacker}>Ice`] ?? 1,
    newMultiplier: Number(m[1]),
  }
}

/**
 * The rationale blocks after the four sentences look like
 * `Ground: It is weak to Ice.` possibly spanning several lines.
 */
function parseRationales(lines) {
  const out = []
  let current = null
  for (const raw of lines) {
    const t = collapse(raw)
    if (!t) continue
    const m = t.match(/^([A-Za-z]+):\s*(.*)$/)
    if (m) {
      current = { type: m[1], parts: [m[2]].filter(Boolean) }
      out.push(current)
    } else if (current) {
      current.parts.push(t)
    }
  }
  return out.map((r) => ({ type: r.type, text: r.parts.join(' ') }))
}

/** The four-column type-change table. */
function parseTypeTable(lines, log, file) {
  const out = []
  for (const line of lines) {
    const t = collapse(line)
    if (!t) continue
    if (/^-+$/.test(t)) continue
    const cells = columns(line)
    if (cells.length < 3) {
      log.unparsedLine(file, line, 'type-change row that is not `#NNN Name  Old  New  Justification`')
      continue
    }
    const head = cells[0].match(/^#(\d{1,3})\s+(.+)$/)
    if (!head) {
      // Column header row (`Pokémon   Old Type   New Type   Justification`).
      continue
    }
    out.push({
      dex: Number(head[1]),
      name: head[2].trim(),
      oldTypes: splitTypes(cells[1]),
      newTypes: splitTypes(cells[2]),
      // Justifications may themselves contain 2+ space runs, so re-join.
      justification: cells.slice(3).join(' '),
    })
  }
  return out
}

/** Parse `TypeChanges.txt` into a `TypeChangesDoc`. */
export function parseTypeChanges(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  const doc = {
    generalNotes: [],
    iceTypeNotes: [],
    chartChanges: [],
    pokemonChanges: [],
    rationales: [],
  }

  for (const section of sections) {
    const title = collapse(section.title)
    if (title === 'General Changes') {
      doc.generalNotes.push(...bulletLines(section.body))
      continue
    }
    if (title === 'Ice Type Changes') {
      const prose = []
      const rationaleLines = []
      let seenSentence = false
      for (const raw of section.body) {
        const t = collapse(raw)
        if (!t) continue
        const sentence = parseChartSentence(t)
        if (sentence) {
          seenSentence = true
          doc.chartChanges.push(sentence)
          continue
        }
        if (seenSentence) rationaleLines.push(raw)
        else prose.push(t)
      }
      doc.iceTypeNotes.push(...prose)
      doc.rationales.push(...parseRationales(rationaleLines))
      // Attach the matching rationale paragraph to each chart cell.
      for (const change of doc.chartChanges) {
        const match = doc.rationales.find((r) => r.type === change.attacker)
        if (match) change.note = match.text
      }
      continue
    }
    if (title === 'Pokémon Type Changes') {
      doc.pokemonChanges.push(...parseTypeTable(section.body, log, file))
      continue
    }
    log.unparsedLine(file, section.title, 'unrecognised section')
  }

  return doc
}
