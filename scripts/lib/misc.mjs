/**
 * misc.mjs — parsers for the "guide" documents: FAQ, NPC changes, in-game
 * trades, level caps and Action Replay codes.
 */

import { collapse, isBullet, isDashRule, splitRuleSections, stripBullet } from './text.mjs'

/* ------------------------------------------------------------------ */
/* FrequentlyAskedQuestions.txt                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse the FAQ.
 *
 * Every question is a `rule / Q: … / rule` section whose body is a bullet
 * list, optionally interrupted by `---`-underlined sub-headings. Bullets that
 * follow a sub-heading belong to it; every other bullet is part of `answer`.
 */
export function parseFaq(lines) {
  const { sections } = splitRuleSections(lines)
  const out = []

  for (const section of sections) {
    const question = collapse(section.title)
    const answer = []
    const subsections = []
    let current = null

    for (let i = 0; i < section.body.length; i++) {
      const raw = section.body[i]
      const t = collapse(raw)
      if (!t) continue
      if (isDashRule(t)) continue

      if (isDashRule(collapse(section.body[i + 1] ?? ''))) {
        current = { title: t, lines: [] }
        subsections.push(current)
        continue
      }

      const text = isBullet(raw) ? stripBullet(raw) : t
      if (current) current.lines.push(text)
      else answer.push(text)
    }

    out.push({ question, answer, subsections })
  }

  return out
}

/* ------------------------------------------------------------------ */
/* NPCChanges.txt                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse `NPCChanges.txt`.
 * `Location: X` has no field of its own inside `NoteSection`, so it is kept as
 * the first line of the section body.
 */
export function parseNpcChanges(lines) {
  const { sections } = splitRuleSections(lines)
  const out = []

  for (const section of sections) {
    const body = []
    const locationLines = []
    for (const raw of section.body) {
      const t = collapse(raw)
      if (!t) continue
      if (/^Location:\s*(.*)$/.test(t)) {
        locationLines.push(t)
        continue
      }
      body.push(isBullet(raw) ? stripBullet(raw) : t)
    }
    out.push({ title: collapse(section.title), lines: [...locationLines, ...body] })
  }

  return out
}

/* ------------------------------------------------------------------ */
/* TradeChanges.txt                                                    */
/* ------------------------------------------------------------------ */

/** `Gaeia the Spheal` -> `{ givenName: "Gaeia", species: "Spheal" }`. */
function parseTradePokemon(text) {
  const m = collapse(text).match(/^(.+?)\s+the\s+(.+)$/)
  if (!m) return { species: text }
  return { givenName: m[1].trim(), species: m[2].trim() }
}

/** Parse `TradeChanges.txt` into `{ trades, tradeNotes }`. */
export function parseTradeChanges(lines, log, file) {
  const { sections } = splitRuleSections(lines)
  const trades = []
  let tradeNotes = []

  for (const section of sections) {
    const title = collapse(section.title)
    if (title !== 'General Changes') {
      log.unparsedLine(file, section.title, 'unexpected section in the trade document')
      continue
    }

    // The whole document after `General Changes` is one section; each city is a
    // heading underlined by `---`.
    const body = section.body
    const blocks = []
    let notesEnd = body.length
    for (let i = 0; i < body.length; i++) {
      if (!isDashRule(collapse(body[i + 1] ?? ''))) continue
      const city = collapse(body[i])
      if (!city) continue
      blocks.push({ city, start: i + 2 })
      notesEnd = Math.min(notesEnd, i)
    }

    tradeNotes = body
      .slice(0, notesEnd)
      .map(collapse)
      .filter(Boolean)
      .map((t) => t.replace(/^-\s*/, ''))

    blocks.forEach((block, index) => {
      const end = index + 1 < blocks.length ? blocks[index + 1].start - 2 : body.length
      const trade = { city: block.city, request: '', lines: [] }
      let phase = 'request'
      for (const raw of body.slice(block.start, end)) {
        const t = collapse(raw)
        if (!t) continue
        if (isDashRule(t)) continue

        const item = t.match(/^-\s*Item:\s*(.*)$/)
        const ivs = t.match(/^-\s*IVs?:\s*(.*)$/)
        const nature = t.match(/^-\s*Nature:\s*(.*)$/)
        if (item) {
          trade.item = item[1].trim()
          continue
        }
        if (ivs) {
          trade.ivs = ivs[1].trim()
          continue
        }
        if (nature) {
          trade.nature = nature[1].trim()
          continue
        }
        if (phase === 'request') {
          trade.request = t
          phase = 'pokemon'
          continue
        }
        if (phase === 'pokemon') {
          // `Gaeia the Spheal` — the Pokémon actually handed over.
          Object.assign(trade, parseTradePokemon(t))
          phase = 'rest'
          continue
        }
        trade.lines.push(isBullet(raw) ? stripBullet(raw) : t)
      }

      trades.push({
        city: trade.city,
        request: trade.request,
        ...(trade.givenName ? { givenName: trade.givenName } : {}),
        ...(trade.species ? { species: trade.species } : {}),
        ...(trade.item ? { item: trade.item } : {}),
        ...(trade.ivs ? { ivs: trade.ivs } : {}),
        ...(trade.nature ? { nature: trade.nature } : {}),
        lines: trade.lines,
      })
    })
  }

  return { trades, tradeNotes }
}

/* ------------------------------------------------------------------ */
/* LevelCaps.txt                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse `LevelCaps.txt` — a flat bullet list, indented by one space.
 * The last line of the file has no trailing newline (`file` calls it CSV
 * text); splitting on `\n` handles that transparently.
 */
export function parseLevelCaps(lines) {
  const out = []
  for (const raw of lines) {
    const t = collapse(raw)
    if (!t) continue
    out.push(isBullet(raw) ? stripBullet(raw) : t)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* ActionReplayCodes.txt                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse `ActionReplayCodes.txt` into `NoteSection[]`.
 * The cheat codes themselves are plain 8+8 hex lines with no label, so they
 * are kept verbatim as section body lines.
 */
export function parseActionReplay(lines) {
  const { sections } = splitRuleSections(lines)
  const out = []
  for (const section of sections) {
    const body = []
    for (const raw of section.body) {
      const t = collapse(raw)
      if (!t) continue
      body.push(isBullet(raw) ? stripBullet(raw) : t)
    }
    out.push({ title: collapse(section.title), lines: body })
  }
  return out
}
