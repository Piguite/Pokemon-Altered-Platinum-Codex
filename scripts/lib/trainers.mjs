/**
 * trainers.mjs — parser for `TrainerPokemon.txt`.
 *
 * Layout of the `Area Changes` section (the area rule follows the area name):
 *
 *   Route 202
 *   ===================
 *   Youngster Tristan (!)       Hoothoot(S) Lv. 7, Starly Lv. 7
 *
 *   Rematches
 *   Youngster Tristan (3)       Noctowl(S) Lv. 27, Staravia Lv. 27
 *
 *   Leader Roark
 *   Lileep (Lv. 15) @ Big Root   /   Suction Cups   /   Mega Drain, Ingrain
 *
 * `Rematches` switches the list further trainer lines are appended to, and a
 * bare trainer name immediately followed by roster lines opens a boss block.
 */

import { bulletLines, collapse, isRule, rawSection, splitRuleSections } from './text.mjs'

/** `Lileep (Lv. 15) @ Big Root   /   Suction Cups   /   Mega Drain, Ingrain` */
const ROSTER = /^(.*?)\s*\(Lv\.\s*(\d+)\)\s*@\s*(.*?)\s*\/\s*(.*?)\s*\/\s*(.*)$/

/** Markers that may follow a trainer name: `!`, `*`, `(3)`, `(C)`, `(S)`. */
const NAME_MARKER = /\s*(?:\((?:\d+|C|S)\)|!|\*)\s*/g

/** `Hoothoot(S) Lv. 7` -> `TeamSlot`; `null` when the chunk is not a slot. */
function parseTeamSlot(chunk) {
  const t = collapse(chunk)
    .replace(/\s*\(!\)\s*$/, '')
    .trim()
  const m = t.match(/^(.*?)\s*Lv\.\s*(\d+)$/)
  if (!m) return null
  const rawSpecies = m[1].trim()
  const isSinnohan = /\(S\)$/.test(rawSpecies)
  const species = rawSpecies.replace(/\s*\(S\)$/, '').trim()
  if (!species) return null
  return { species, level: Number(m[2]), isSinnohan }
}

/**
 * Parse a trainer line: `Name [markers]   Species Lv. N, Species Lv. N`.
 * Returns `null` when the line is not a roster line.
 */
function parseTrainerLine(line) {
  // The name/team separator is a run of 2+ spaces (or a tab), so it must be
  // located *before* the line is collapsed.
  const tabular = line.replace(/\t/g, '    ').trimEnd()
  const m = tabular.match(/^(.*?)\s{2,}(\S.*)$/)
  let namePart
  let teamText
  if (m) {
    namePart = m[1].trimEnd()
    teamText = m[2].trim()
  } else {
    // A handful of lines (the `Interviewers Roxy & Oli` rematches) use a single
    // space before the team. Fall back to the first `Species Lv. N` token.
    const first = tabular.match(/[A-Z][\w.'’♀♂-]*(?:\(S\))?\s+Lv\.\s*\d+/)
    if (!first) return null
    let start = first.index
    const prefix = tabular.slice(0, start)
    const honorific = prefix.match(/(?:Mr\.|Jr\.)\s*$/)
    if (honorific) start -= honorific[0].length
    namePart = tabular.slice(0, start).trimEnd()
    teamText = tabular.slice(start).trim()
  }
  if (!namePart || !teamText) return null
  if (!/Lv\.\s*\d+/.test(teamText)) return null

  const markers = namePart.match(NAME_MARKER) ?? []
  const name = namePart.replace(NAME_MARKER, ' ').replace(/\s{2,}/g, ' ').trim()

  const team = []
  for (const chunk of teamText.split(',')) {
    const slot = parseTeamSlot(chunk)
    if (slot) team.push(slot)
  }
  if (!team.length) return null

  return { name, markers: markers.map((x) => x.trim()), team, raw: tabular.trim() }
}

/** Boss roster line -> `BossSlot`; `null` when the line is not a roster line. */
function parseBossSlot(line) {
  const m = collapse(line).match(ROSTER)
  if (!m) return null
  const rawSpecies = m[1].trim()
  const isSinnohan = /\(S\)$/.test(rawSpecies)
  const species = rawSpecies.replace(/\s*\(S\)$/, '').trim()
  const item = m[3].trim()
  const ability = m[4].trim()
  const moves = m[5]
    .replace(/\s*\(!\)\s*$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    species,
    level: Number(m[2]),
    isSinnohan,
    ...(item && !/^none$/i.test(item) ? { item } : {}),
    ...(ability ? { ability } : {}),
    moves,
  }
}

/** Parse `TrainerPokemon.txt` into a `TrainersDoc`. */
export function parseTrainerPokemon(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  /**
   * `TrainersDoc.generalNotes` is a flat `string[]`, while
   * `DocumentStat.generalNotes` needs `NoteSection[]` — both are produced here.
   */
  const doc = { generalNotes: [], levelCaps: [], areas: [] }
  const documentNotes = []
  let areaChanges = null

  for (const section of sections) {
    const title = collapse(section.title)
    if (title === 'General Changes') {
      doc.generalNotes.push(...bulletLines(section.body))
      documentNotes.push(rawSection(title, section.body))
    } else if (title === 'Level Caps') {
      const prose = []
      for (const raw of section.body) {
        const t = collapse(raw)
        if (!t) continue
        if (/^-\s/.test(t)) doc.levelCaps.push(t.replace(/^-\s*/, ''))
        else {
          doc.generalNotes.push(t)
          prose.push(t)
        }
      }
      if (prose.length) documentNotes.push({ title: 'Level Caps', lines: prose })
    } else if (title === 'Area Changes') {
      areaChanges = section.body
    } else {
      doc.generalNotes.push(...bulletLines(section.body))
      documentNotes.push(rawSection(title, section.body))
    }
  }

  if (!areaChanges) {
    log.unparsedLine(file, 'Area Changes', 'the `Area Changes` section was not found')
    return { ...doc, documentNotes }
  }

  /**
   * `TrainerArea` only carries `area`, `trainers`, `rematches` and `bosses`, so
   * a prose line or sub-heading inside an area (`Round 1`, `With Rock Climb`,
   * `[Battle Marathon Only]`, the Elite Four round note) is promoted to
   * `generalNotes` with an area prefix instead of being dropped.
   */
  const stray = (areaName, text) => {
    // Relocated, not unparsed: `generalNotes` is a typed field, so these lines
    // are not counted in the unparsed audit. The area prefix keeps the context
    // that `TrainerArea` cannot hold.
    doc.generalNotes.push(`${areaName}: ${text}`)
    documentNotes.push({ title: `${areaName} — note`, lines: [text] })
    log.note(`TrainerPokemon.txt: "${text}" has no field on TrainerArea and was moved to generalNotes (${areaName}).`)
  }

  let area = null
  let inRematches = false
  let boss = null

  for (let i = 0; i < areaChanges.length; i++) {
    const raw = areaChanges[i]
    const t = collapse(raw)
    if (!t) continue
    if (isRule(raw) || /^-+$/.test(t)) continue

    // Area header: the name sits directly above its `===` rule.
    if (isRule(areaChanges[i + 1] ?? '')) {
      area = { area: t, trainers: [], rematches: [], bosses: [] }
      doc.areas.push(area)
      inRematches = false
      boss = null
      continue
    }

    if (/^Rematches$/.test(t)) {
      inRematches = true
      boss = null
      continue
    }

    const slot = parseBossSlot(raw)
    if (slot) {
      if (!area) {
        log.unparsedLine(file, raw, 'boss roster line outside any area')
        continue
      }
      if (!boss) {
        boss = { name: '', team: [] }
        area.bosses.push(boss)
      }
      boss.team.push(slot)
      continue
    }

    const trainer = parseTrainerLine(raw)
    if (trainer) {
      if (!area) {
        log.unparsedLine(file, raw, 'trainer line outside any area')
        continue
      }
      ;(inRematches ? area.rematches : area.trainers).push(trainer)
      // A trainer line immediately followed by roster lines also names a
      // detailed boss block (`Arcade Star Dahlia`, the Barry/Cynthia sets).
      boss = parseBossSlot(areaChanges[i + 1] ?? '') ? { name: trainer.name, team: [] } : null
      if (boss) area.bosses.push(boss)
      continue
    }

    // A bare name whose next line is a roster line opens a boss block.
    if (parseBossSlot(areaChanges[i + 1] ?? '')) {
      boss = { name: t, team: [] }
      if (area) area.bosses.push(boss)
      else log.unparsedLine(file, raw, 'boss name outside any area')
      continue
    }

    if (!area) {
      log.unparsedLine(file, raw, 'line before the first area heading')
      continue
    }
    if (/Lv\.\s*\d+/.test(t)) {
      log.unparsedLine(file, raw, 'roster line that could not be parsed')
      boss = null
      continue
    }
    stray(area.area, t)
    boss = null
  }

  for (const a of doc.areas) a.bosses = a.bosses.filter((b) => b.name && b.team.length)

  return { ...doc, documentNotes }
}
