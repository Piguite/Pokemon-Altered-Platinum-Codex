/**
 * moves.mjs — parser for `MoveChanges.txt`.
 *
 * Four shapes live in this document:
 *  - a replacement table (`Old Move  New Move`) whose rows are separated by
 *    tabs on some lines and by spaces on others,
 *  - `Name` + labelled property blocks for the ten brand-new moves,
 *  - `Move` + `Label: from >> to` blocks for numeric modifications,
 *  - a batch ("Move Group Modifications") section whose headings list several
 *    moves separated by `/`; one heading becomes ONE `MoveModification` whose
 *    `moves[]` lists them all, and a `Label(Move):` line becomes an entry in
 *    `exceptions[]` instead of being attributed to the whole group.
 */

import { bodyLines, bulletLines, collapse, columns, rawSection, splitGroup, splitRuleSections } from './text.mjs'

/** Labels used by the new-move blocks. */
const MOVENEW_LABELS = new Set(['Type', 'Class', 'Power', 'PP', 'Accuracy', 'Effect', 'Description'])

/** `Label: value` (the label may carry a qualifier, e.g. `Effect(Hurricane)`). */
const LABELLED = /^([A-Za-z][A-Za-z ()]*?)\s*:\s*(.*)$/

/** The change arrow used throughout the move document. */
const ARROW = '>>'

function isFieldLabel(label) {
  return (
    MOVENEW_LABELS.has(label) ||
    /^Effect\s*\(/.test(label) ||
    ['Recovery', 'Successive Hits Power', 'Effect Chance'].includes(label)
  )
}

/** Parse `Power: 20 >> 40` into a `MoveFieldChange`. */
function parseFieldChange(line) {
  const m = collapse(line).match(LABELLED)
  if (!m) return null
  const label = m[1].trim()
  if (!isFieldLabel(label)) return null
  const value = m[2].trim()
  const arrow = value.indexOf(ARROW)
  // `Effect: Lower own Defense and Special Defense` states the new behaviour
  // only — `from` stays empty rather than inventing a previous value.
  if (arrow === -1) return { label, from: '', to: value }
  return { label, from: value.slice(0, arrow).trim(), to: value.slice(arrow + ARROW.length).trim() }
}

/**
 * The narrative lines at the top of a section: everything before the first
 * blank line. They carry the context the UI shows above a table and have no
 * typed field of their own.
 */
function preamble(lines) {
  const out = []
  for (const raw of lines) {
    const t = collapse(raw)
    if (!t) break
    out.push(t)
  }
  return out
}

/**
 * The section body with its leading narrative run removed.
 *
 * Without this, a section preamble such as "Batch changes made to multiple
 * similar moves." reaches a block parser as a *heading* — producing a phantom
 * record with an empty `changes[]` that the UI then renders as if it were a
 * move modification.
 */
function withoutPreamble(lines) {
  let i = 0
  for (; i < lines.length; i++) {
    if (!collapse(lines[i])) {
      i++
      break
    }
  }
  return lines.slice(i)
}

/** Replacement table -> `MoveReplacement[]`. */
function parseReplacements(lines, log, file) {
  const out = []
  // Lines before the first table row are the section preamble; they are kept in
  // `noteSections` and are not counted as unparsed.
  let started = false
  for (const line of lines) {
    const t = collapse(line)
    if (!t) continue
    if (/^-+$/.test(t)) continue
    const cells = columns(line)
    // The table underline row (`---------   ---------`) splits into two cells
    // that are nothing but dashes.
    if (cells.every((c) => /^-+$/.test(c))) continue
    if (cells.length < 2) {
      if (!started) continue
      log.unparsedLine(file, line, 'replacement row that is not `Old Move  New Move`')
      continue
    }
    if (/^old move$/i.test(cells[0])) continue
    started = true
    let newMove = cells.slice(1).join(' ')
    let isNew = false
    const m = newMove.match(/^(.*?)\s*\(new\)$/)
    if (m) {
      newMove = m[1].trim()
      isNew = true
    }
    out.push({ oldMove: cells[0], newMove, isNew })
  }
  return out
}

/** `New Moves` section -> `NewMove[]`. */
function parseNewMoves(lines, log, file) {
  const out = []
  let current = null
  for (const raw of lines) {
    const t = collapse(raw)
    if (!t) continue
    const m = t.match(LABELLED)
    const label = m ? m[1].trim() : null
    if (label && MOVENEW_LABELS.has(label)) {
      if (!current) {
        log.unparsedLine(file, raw, 'new-move property before any move name')
        continue
      }
      const value = m[2].trim()
      if (label === 'Power' || label === 'PP' || label === 'Accuracy') current[label.toLowerCase()] = Number(value)
      else if (label === 'Type') current.type = value
      else if (label === 'Class') current.class = value
      else if (label === 'Effect') current.effect = value
      else if (label === 'Description') current.description = value
      continue
    }
    if (label) {
      log.unparsedLine(file, raw, 'unexpected label inside a new-move block')
      continue
    }
    current = { name: t }
    out.push(current)
  }
  return out
}

/**
 * Split a qualifier off a field label: `Effect(Hurricane)` ->
 * `{ label: 'Effect', qualifier: 'Hurricane' }`.
 *
 * The qualifier names the *subset* of a group the change applies to. Treating
 * `Effect(Hurricane): Confusion (30%) >> No Effect` as a plain `MoveFieldChange`
 * is what made the pipeline attribute Hurricane's lost effect to Fire Blast,
 * Thunder, Blizzard, Hydro Pump and Focus Blast as well.
 */
function splitQualifier(label) {
  const match = String(label).match(/^([A-Za-z][A-Za-z ]*?)\s*\(([^)]+)\)$/)
  if (!match) return { label: String(label), qualifier: null }
  return { label: match[1].trim(), qualifier: match[2].trim() }
}

/** The member of a group a qualifier points at, or `null` when it names none. */
function resolveQualifier(qualifier, members) {
  const key = qualifier.toLowerCase().trim()
  const exact = members.find((move) => move.toLowerCase().trim() === key)
  if (exact) return exact
  const partial = members.find((move) => move.toLowerCase().includes(key))
  return partial ?? null
}

/**
 * Heading -> one `MoveModification`.
 *
 * Plain sections (`Move Modifications`) hold one move per heading. The batch
 * section (`Move Group Modifications`) lists several, separated by `/`, and may
 * add one more move with `(plus X)` — `Elemental Fangs(plus Poison Fang)`, whose
 * `Effect(Poison Fang)` change must stay a subset exception rather than being
 * attributed to every member.
 */
function modificationRecord(heading, groups) {
  const name = heading.replace(/:\s*$/, '').trim()
  if (!groups) return { label: name, moves: [name], changes: [], exceptions: [] }

  const plus = name.match(/^(.*?)\(\s*plus\s+([^)]+)\)\s*$/i)
  const members = splitGroup(plus ? plus[1] : name)
  if (plus) members.push(...splitGroup(plus[2]))
  const moves = members.length ? members : [name]
  return { label: moves.join(' / '), moves, changes: [], exceptions: [] }
}

/**
 * `Name` + `Label: from >> to` blocks -> `MoveModification[]`.
 *
 * With `groups: true` one heading covers several moves: `moves` keeps them all,
 * `changes` apply to the whole group and `exceptions` carry the `Label(Move):`
 * lines that only concern one member.
 */
function parseModificationBlocks(lines, log, file, { groups = false } = {}) {
  const out = []
  let current = null

  for (const raw of lines) {
    const t = collapse(raw)
    if (!t) continue

    const field = parseFieldChange(raw)
    if (field) {
      if (!current) {
        log.unparsedLine(file, raw, 'modification line before any move name')
        continue
      }
      const { label, qualifier } = splitQualifier(field.label)
      if (qualifier) {
        const owner = resolveQualifier(qualifier, current.moves)
        if (owner) {
          current.exceptions.push({ label, from: field.from, to: field.to, moves: [owner] })
          continue
        }
        log.warn(
          `MoveChanges.txt: "${field.label}" names "${qualifier}", which is not one of ` +
            `[${current.moves.join(', ')}] — kept as a plain change on the whole record`,
        )
        current.changes.push({ label: field.label, from: field.from, to: field.to })
        continue
      }
      current.changes.push({ label, from: field.from, to: field.to })
      continue
    }

    // A footnote is a sentence (move names never contain `.` or `,`).
    if (current && /[.,]/.test(t)) {
      current.changes.push({ label: 'Note', from: '', to: t })
      continue
    }

    current = modificationRecord(t, groups)
    out.push(current)
  }
  return out
}

/** Parse `MoveChanges.txt`. */
export function parseMoveChanges(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  const doc = {
    generalNotes: [],
    replacements: [],
    newMoves: [],
    modifications: [],
    groupModifications: [],
    groupNotes: [],
    noteSections: [],
  }

  for (const section of sections) {
    const title = collapse(section.title)
    switch (title) {
      case 'General Changes':
        doc.generalNotes.push(...bulletLines(section.body))
        break
      case 'Move Replacements':
        doc.replacements = parseReplacements(section.body, log, file)
        doc.noteSections.push(rawSection(title, preamble(section.body)))
        break
      case 'New Moves':
        doc.newMoves = parseNewMoves(section.body, log, file)
        doc.noteSections.push(rawSection(title, preamble(section.body)))
        break
      case 'Move Modifications':
        doc.modifications = parseModificationBlocks(withoutPreamble(section.body), log, file)
        doc.noteSections.push(rawSection(title, preamble(section.body)))
        break
      case 'Move Group Modifications':
        /*
         * The leading prose ("Batch changes made to multiple similar moves.")
         * introduces the grouped records; it is not a modification of its own,
         * so it goes to `groupNotes` only — it must NOT also become a record.
         */
        doc.groupNotes = preamble(section.body)
        doc.groupModifications = parseModificationBlocks(withoutPreamble(section.body), log, file, {
          groups: true,
        })
        break
      default:
        doc.noteSections.push(rawSection(title, bodyLines(section.body)))
        break
    }
  }

  doc.noteSections = doc.noteSections.filter((s) => s.lines.length > 0)
  return doc
}
