/**
 * items.mjs — parser for `ItemChanges.txt`.
 *
 * The document mixes bullet groups (use-options, costs, vitamin swaps) with
 * several fixed-width tables (item locations, TM locations, plate locations,
 * replaced items) and one department-store inventory listing.
 */

import { bodyLines, collapse, columns, isBullet, rawSection, splitRuleSections, stripBullet } from './text.mjs'

const DASHES = /^-+$/

/** `true` when every cell of a table row is nothing but dashes. */
const isDashRow = (cells) => cells.length > 0 && cells.every((c) => /^-+$/.test(c))
const COST = /^(.*?)\s*\(\s*(\$[\d,]+|N\/A)\s*>>\s*(\$[\d,]+|N\/A)\s*\)\s*$/

/** `$1,200` -> `1200`; `N/A` -> `null`. */
function parsePrice(text) {
  if (!text) return null
  const cleaned = text.replace(/[$,\s]/g, '')
  if (/^n\/a$/i.test(text.trim()) || cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * `- Poké Ball     ($200 >> $50)` -> CostChange.
 *
 * Bullets without an arrow belong to the "now cost zero and are thus
 * unsellable" list (`- All TMs`), so their new price is explicitly **0** rather
 * than null — the source states the price, it just does not use the `$a >> $b`
 * form to say it.
 */
function parseCostBullet(text, group = 'cost') {
  const m = text.match(COST)
  if (m) {
    return { item: m[1].trim(), oldPrice: parsePrice(m[2]), newPrice: parsePrice(m[3]), raw: text }
  }
  return {
    item: text.trim(),
    oldPrice: null,
    newPrice: group === 'zero' ? 0 : null,
    raw: text.trim(),
  }
}

/** A two-column table (`Item  Locations`) -> rows of joined cell text. */
function parseTwoColumnTable(lines, log, file, reason) {
  const rows = []
  const prose = []
  // Everything before the first table row is section preamble (kept in
  // `noteSections`); only unexpected rows *inside* the table are reported.
  let started = false
  for (const line of lines) {
    const t = collapse(line)
    if (!t) continue
    if (DASHES.test(t)) continue
    const cells = columns(line)
    if (isDashRow(cells)) continue
    // Column header rows: `Item   Locations`, `Item   Master Trainer Location`.
    if (/^(item|tm)$/i.test(cells[0] ?? '') && cells.length >= 2) continue
    if (cells.length < 2) {
      if (!started) {
        prose.push(t)
        continue
      }
      log.unparsedLine(file, line, reason)
      continue
    }
    started = true
    rows.push(cells)
  }
  return { rows, prose }
}

/** Parse `ItemChanges.txt` into an `ItemsDoc`. */
export function parseItemChanges(lines, log, file) {
  const { sections } = splitRuleSections(lines)

  const doc = {
    generalNotes: [],
    usableItems: [],
    costChanges: [],
    tmChanges: [],
    martChanges: [],
    deptStoreStock: [],
    itemLocations: [],
    tmLocations: [],
    vitaminReplacements: [],
    plateLocations: [],
    replacedItems: [],
    noteSections: [],
  }

  for (const section of sections) {
    const title = collapse(section.title)
    switch (title) {
      case 'Modified Items': {
        // Three bullet groups preceded by a sentence introducing each one.
        let group = null
        const prose = []
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (!isBullet(raw)) {
            prose.push(t)
            if (/now have a "Use" option/i.test(t)) group = 'usable'
            else if (/adjustments to their costs/i.test(t)) group = 'cost'
            else if (/now cost zero/i.test(t)) group = 'zero'
            continue
          }
          const text = stripBullet(raw)
          if (group === 'usable') doc.usableItems.push(text)
          else if (group === 'cost' || group === 'zero') doc.costChanges.push(parseCostBullet(text, group))
          else log.unparsedLine(file, raw, 'bullet outside a recognised item group')
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      case 'Modified TMs': {
        const prose = []
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (isBullet(raw)) {
            const text = stripBullet(raw)
            const m = text.match(/^(TM\d{2})\s*:\s*(.*?)\s*>>\s*(.*)$/)
            if (m) {
              doc.tmChanges.push({ tm: m[1], move: m[3].trim() })
              // `tmChanges` keeps only the new move, so the raw bullet — which
              // still names the move it replaces — is retained as a note.
              prose.push(text)
            } else {
              prose.push(text)
            }
            continue
          }
          prose.push(t)
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      case 'Poké Mart Inventory': {
        const prose = []
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (t.includes('>>')) doc.martChanges.push(t)
          else prose.push(t)
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      case 'Veilstone Dept. Store Inventory': {
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t || DASHES.test(t)) continue
          doc.deptStoreStock.push(t)
        }
        break
      }
      case 'Item Locations': {
        const table = parseTwoColumnTable(section.body, log, file, 'item-location row without a location column')
        for (const cells of table.rows) {
          doc.itemLocations.push({ item: cells[0], locations: cells.slice(1).join(' ') })
        }
        doc.noteSections.push(rawSection(title, table.prose))
        break
      }
      case 'TM Locations': {
        const prose = []
        let started = false
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (DASHES.test(t)) continue
          const cells = columns(raw)
          if (isDashRow(cells)) continue
          // Column header: `TM   Location   Obtained`.
          if (cells.length >= 2 && /^TM$/i.test(cells[0]) && /^Location$/i.test(cells[1])) continue
          if (cells.length < 3) {
            if (/^TM\s+Location/i.test(t)) continue
            if (!started) {
              prose.push(t)
              continue
            }
            log.unparsedLine(file, raw, 'TM-location row that is not `TM NN Move  Location  Obtained`')
            continue
          }
          const head = cells[0].match(/^(TM\d{2}|HM\d{2})\s+(.+)$/)
          if (!head) {
            log.unparsedLine(file, raw, 'TM-location row without a TM/HM number')
            continue
          }
          started = true
          // `TM01 Focus Punch   Oreburgh Gate   Item on ground   *`
          // The trailing `*` marks "location changed from vanilla Platinum".
          const changed = cells.length > 3 && cells.slice(3).some((c) => /\*/.test(c))
          doc.tmLocations.push({
            tm: head[1],
            move: head[2].trim(),
            location: cells[1].replace(/\s*\*+\s*$/, '').trim(),
            obtained: cells[2].replace(/\s*\*+\s*$/, '').trim(),
            changed,
          })
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      case 'Vitamin Replacements': {
        const prose = []
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (t.includes('>>')) doc.vitaminReplacements.push(t)
          else prose.push(t)
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      case 'Plate Locations': {
        const table = parseTwoColumnTable(section.body, log, file, 'plate-location row without a location column')
        for (const cells of table.rows) {
          doc.plateLocations.push(`${cells[0]}: ${cells.slice(1).join(' ')}`)
        }
        doc.noteSections.push(rawSection(title, table.prose))
        break
      }
      case 'Replaced Items': {
        const prose = []
        for (const raw of section.body) {
          const t = collapse(raw)
          if (!t) continue
          if (DASHES.test(t)) continue
          const cells = columns(raw)
          if (isDashRow(cells)) continue
          if (cells.length < 2) {
            prose.push(t)
            continue
          }
          if (/^Old Item$/i.test(cells[0])) continue
          const noteMatch = cells[1].match(/\s*(\*+)\s*$/)
          doc.replacedItems.push({
            oldItem: cells[0],
            newItem: cells[1].replace(/\s*\*+\s*$/, '').trim(),
            ...(noteMatch ? { note: noteMatch[1] } : {}),
          })
        }
        doc.noteSections.push(rawSection(title, prose))
        break
      }
      default:
        doc.noteSections.push(rawSection(title, bodyLines(section.body)))
        break
    }
  }

  doc.noteSections = doc.noteSections.filter((s) => s.lines.length > 0)
  return doc
}
