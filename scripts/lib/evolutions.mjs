/**
 * evolutions.mjs — parser for `EvolutionChanges.txt`.
 *
 * Each section is a bullet list shaped `- Pokemon: full sentence.`; the bullet
 * is split into the Pokémon it concerns (`entries[].pokemon`) and its full text
 * so the UI can group or filter by species.
 */

import { collapse, isBullet, splitRuleSections, stripBullet } from './text.mjs'

/** Parse `EvolutionChanges.txt` into an `EvolutionsDoc`. */
export function parseEvolutionChanges(lines) {
  const { sections } = splitRuleSections(lines)
  const out = []

  for (const section of sections) {
    const title = collapse(section.title)
    const body = []
    const entries = []
    for (const raw of section.body) {
      const t = collapse(raw)
      if (!t) continue
      if (isBullet(raw)) {
        const text = stripBullet(raw)
        body.push(text)
        // `Poliwhirl: Now able to evolve into Politoed by using a King's Rock.`
        const m = text.match(/^([^:]{1,40}):\s*(.+)$/)
        entries.push(m ? { pokemon: m[1].trim(), text } : { pokemon: '', text })
      } else {
        // Free prose such as the `"Using" in this context ...` note. It has no
        // entry of its own but is a typed `lines[]` member, so it is retained.
        body.push(t)
      }
    }
    out.push({ title, lines: body, entries })
  }

  return { sections: out }
}
