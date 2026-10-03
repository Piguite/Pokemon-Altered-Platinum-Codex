/**
 * events.mjs — parser for `SpecialEvents.txt`.
 *
 * Section (Gift Pokémon / Special Encounters / Legendary Encounters) contains
 * event entries shaped:
 *
 *   #133 Eevee
 *   ---
 *   Location: Twinleaf Town
 *   Level: 5
 *
 *   - Interact with the Poké Ball to get Eevee.
 */

import { collapse, isDashRule, splitRuleSections } from './text.mjs'

const LOCATION = /^Location:\s*(.*)$/
const LEVEL = /^Level:\s*(.*)$/

/** Parse `SpecialEvents.txt` into an `EventsDoc`. */
export function parseSpecialEvents(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  const doc = { generalNotes: [], sections: [] }

  for (const section of sections) {
    const title = collapse(section.title)
    if (title === 'General Notes') {
      for (const raw of section.body) {
        const t = collapse(raw)
        if (!t) continue
        doc.generalNotes.push(t.replace(/^-\s*/, ''))
      }
      continue
    }

    const items = []
    let current = null
    for (let i = 0; i < section.body.length; i++) {
      const raw = section.body[i]
      const t = collapse(raw)
      if (!t) continue
      if (isDashRule(t)) continue

      // `Title` followed (immediately) by a `---` rule opens a new event.
      if (isDashRule(collapse(section.body[i + 1] ?? ''))) {
        current = { title: t, lines: [] }
        items.push(current)
        continue
      }

      if (!current) {
        log.unparsedLine(file, raw, 'content before the first event title')
        continue
      }

      const location = t.match(LOCATION)
      if (location) {
        current.location = location[1].trim()
        continue
      }
      const level = t.match(LEVEL)
      if (level) {
        current.level = level[1].trim()
        continue
      }
      current.lines.push(t.replace(/^-\s*/, ''))
    }

    doc.sections.push({
      title,
      items: items.map((item) => ({
        title: item.title,
        ...(item.location ? { location: item.location } : {}),
        ...(item.level ? { level: item.level } : {}),
        lines: item.lines,
      })),
    })
  }

  return doc
}
