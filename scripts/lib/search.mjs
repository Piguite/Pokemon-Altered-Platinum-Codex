/**
 * search.mjs — builds `search-index.json`.
 *
 * One `SearchRecord` per thing a visitor may look up. The `body` holds extra
 * words that are never rendered, which is what makes queries such as
 * "who learns Boomburst?" work: every Pokémon record lists its full learnset.
 *
 * Trainer records are one per *area* (not per trainer line) because the area
 * record already carries the complete roster.
 */

import { slugify } from './text.mjs'

/** Join parts, dropping empties, and collapse whitespace. */
const text = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

/** `{ hp, atk, ... }` -> `78/84/78/110/85/110`. */
const statLine = (s) => `${s.hp}/${s.atk}/${s.def}/${s.spa}/${s.spd}/${s.spe} (BST ${s.bst})`

const listOf = (items) => items.filter(Boolean).join(', ')

/** Every move name a learnset contains. */
function learnsetWords(learnset) {
  return listOf([
    learnset.levelUp.map((l) => l.move).join(', '),
    learnset.tm.map((t) => t.move).join(', '),
    learnset.tutor.map((t) => t.move).join(', '),
  ])
}

/* ------------------------------------------------------------------ */

function pokemonRecords(pokemon) {
  return pokemon.map((p) => {
    /*
     * rev 3: `baseTypes` is present for all 493 entries, so a species the
     * documents never re-type (every legendary, among others) is still findable
     * by its type and shows a type chip in the result row.
     */
    const badges = p.type ? p.type.new : (p.baseTypes ?? [])
    const body = text(
      `#${String(p.dex).padStart(3, '0')} ${p.name}${p.isSinnohan ? ' Sinnohan form' : ''}`,
      p.type ? `type ${p.type.old.join('/')} to ${p.type.new.join('/')}` : '',
      p.baseTypes?.length ? `type ${p.baseTypes.join('/')}` : '',
      p.stats ? `base stats ${statLine(p.stats.old)} to ${statLine(p.stats.new)}` : '',
      p.ability ? `ability ${p.ability.old.join('/')} to ${p.ability.new.join('/')}` : '',
      p.moves.length ? p.moves.map((m) => m.text).join(' ') : '',
      p.evolution.length ? p.evolution.join(' ') : '',
      p.heldItem ?? '',
      p.baseHappiness ? `base happiness ${p.baseHappiness}` : '',
      p.genderRatio ?? '',
      p.forms.map((f) => text(f.form, f.types ? f.types.join('/') : '', f.ability ? `${f.ability.new.join('/')}` : '', f.levelUp ? learnsetWords({ levelUp: f.levelUp, tm: [], tutor: [] }) : '', f.moves ? f.moves.map((m) => m.text).join(' ') : '')).join(' '),
      learnsetWords(p.learnset),
    )
    return {
      id: `pokemon-${p.dex}`,
      kind: 'pokemon',
      title: p.name,
      subtitle: `#${String(p.dex).padStart(3, '0')}${p.type ? ` · ${p.type.new.join(' / ')}` : ''}${p.isSinnohan ? ' · Sinnohan' : ''}`,
      body,
      route: `#/pokemon/${p.slug}`,
      badges,
    }
  })
}

function sinnohanRecords(forms) {
  return forms.map((f) => ({
    id: `sinnohan-${f.dex}`,
    kind: 'sinnohan',
    title: f.name,
    subtitle: `#${String(f.dex).padStart(3, '0')} · ${f.types.join(' / ')}`,
    body: text(
      `Sinnohan ${f.baseName} regional form`,
      f.types.join('/'),
      f.abilities.join('/'),
      `base stats ${statLine(f.stats)}`,
      f.evolution.join(' '),
      learnsetWords(f.learnset),
    ),
    route: `#/sinnohan/${f.slug}`,
    badges: f.types,
  }))
}

function typeRecords(typeChanges) {
  const records = []
  for (const entry of typeChanges.pokemonChanges) {
    records.push({
      id: `type-change-${entry.dex}`,
      kind: 'type',
      title: `${entry.name} type change`,
      subtitle: `${entry.oldTypes.join(' / ')} → ${entry.newTypes.join(' / ')}`,
      body: text(`#${entry.dex} ${entry.name}`, entry.oldTypes.join('/'), entry.newTypes.join('/'), entry.justification),
      route: '#/types',
      badges: [...entry.oldTypes, ...entry.newTypes],
    })
  }
  for (const change of typeChanges.chartChanges) {
    records.push({
      id: `type-chart-${slugify(`${change.attacker}-${change.defender}`)}`,
      kind: 'type',
      title: `${change.attacker} → ${change.defender}`,
      subtitle: `${change.oldMultiplier}x → ${change.newMultiplier}x`,
      body: text(
        `Ice type chart change: ${change.defender} now takes ${change.newMultiplier}x from ${change.attacker}`,
        change.note ?? '',
      ),
      route: '#/types',
      badges: [change.attacker, change.defender],
    })
  }
  return records
}

function moveRecords(moves) {
  const records = []
  for (const move of moves.newMoves) {
    records.push({
      id: `move-new-${slugify(move.name)}`,
      kind: 'move',
      title: move.name,
      subtitle: `New move${move.type ? ` · ${move.type}` : ''}`,
      body: text('new move', move.type, move.class, move.power != null ? `power ${move.power}` : '', move.pp != null ? `pp ${move.pp}` : '', move.accuracy != null ? `accuracy ${move.accuracy}` : '', move.effect, move.description),
      route: '#/moves',
      badges: [move.type, move.class?.split(',')[0]].filter(Boolean),
    })
  }
  for (const replacement of moves.replacements) {
    records.push({
      id: `move-replacement-${slugify(replacement.oldMove)}`,
      kind: 'move',
      title: `${replacement.oldMove} → ${replacement.newMove}`,
      subtitle: replacement.isNew ? 'Replaced by a new move' : 'Replaced move',
      body: text(replacement.oldMove, replacement.newMove, replacement.isNew ? 'brand new move introduced by the hack' : ''),
      route: '#/moves',
      badges: replacement.isNew ? ['new'] : [],
    })
  }
  /*
   * `MoveModification` records are indexed by their `label`/`moves` (rev 2):
   * a single-move record covers one move, a grouped one covers several, and the
   * `Label(Move):` exceptions are indexed alongside the shared changes.
   */
  const modificationRecords = [
    ...(moves.modifications ?? []).map((mod) => ({ mod, group: false })),
    ...(moves.groupModifications ?? []).map((mod) => ({ mod, group: true })),
  ]
  modificationRecords.forEach(({ mod, group }, index) => {
    const changes = [
      ...mod.changes.map((c) => `${c.label} ${c.from} to ${c.to}`),
      ...mod.exceptions.map((c) => `${c.label} (${c.moves.join(', ')}) ${c.from} to ${c.to}`),
    ]
    records.push({
      id: `move-mod-${slugify(mod.label) || index}`,
      kind: 'move',
      title: mod.label,
      subtitle: group
        ? `${mod.moves.length} moves · ${mod.changes.length} shared change${mod.changes.length === 1 ? '' : 's'}`
        : `${mod.changes.length} change${mod.changes.length === 1 ? '' : 's'}`,
      body: text(mod.moves.join(' '), changes.join(' ')),
      route: '#/moves',
      badges: group ? [`${mod.moves.length} moves`] : [],
    })
  })
  return records
}

function itemRecords(items) {
  const records = []
  const push = (id, title, subtitle, body, badges = []) =>
    records.push({ id, kind: 'item', title, subtitle, body, route: '#/items', badges })

  for (const name of items.usableItems) push(`item-usable-${slugify(name)}`, name, 'Now has a "Use" option', name)
  for (const cost of items.costChanges)
    push(
      `item-cost-${slugify(cost.item)}`,
      cost.item,
      cost.oldPrice != null || cost.newPrice != null ? `${cost.oldPrice ?? '?'} → ${cost.newPrice ?? '?'}` : 'Cost change',
      text(cost.item, cost.raw),
    )
  for (const tm of items.tmChanges) push(`item-tm-${tm.tm}`, `${tm.tm}: ${tm.move}`, 'TM move changed', `${tm.tm} ${tm.move}`)
  for (const line of items.martChanges) push(`item-mart-${slugify(line)}`, line, 'Poké Mart inventory', line)
  for (const line of items.deptStoreStock) push(`item-store-${slugify(line)}`, line, 'Veilstone Dept. Store stock', line)
  for (const row of items.itemLocations) push(`item-location-${slugify(row.item)}`, row.item, 'Item location', text(row.item, row.locations))
  for (const tm of items.tmLocations)
    push(
      `item-tmlocation-${tm.tm}`,
      `${tm.tm} ${tm.move}`,
      `${tm.location} · ${tm.obtained}`,
      text(tm.tm, tm.move, tm.location, tm.obtained, tm.changed ? 'location changed from Platinum' : ''),
      tm.changed ? ['changed'] : [],
    )
  for (const line of items.vitaminReplacements) push(`item-vitamin-${slugify(line)}`, line, 'Vitamin replacement', line)
  for (const line of items.plateLocations) push(`item-plate-${slugify(line)}`, line.split(':')[0], 'Arceus plate location', line)
  for (const replaced of items.replacedItems)
    push(`item-replaced-${slugify(replaced.oldItem)}`, `${replaced.oldItem} → ${replaced.newItem}`, 'Replaced item', text(replaced.oldItem, replaced.newItem))

  return records
}

function evolutionRecords(evolutions) {
  const records = []
  for (const section of evolutions.sections) {
    section.entries.forEach((entry, index) => {
      records.push({
        id: `evolution-${slugify(section.title)}-${index}`,
        kind: 'evolution',
        title: entry.pokemon ? `${entry.pokemon} evolution change` : 'Evolution change',
        subtitle: section.title,
        body: text(entry.pokemon, entry.text, section.title),
        route: '#/evolutions',
        badges: [],
      })
    })
  }
  return records
}

/** One record per area, with the complete roster in `body`. */
function trainerRecords(areas) {
  return areas.map((area) => {
    const trainerLines = area.trainers.map((t) => `${t.name} ${t.markers.join(' ')}: ${t.team.map((s) => `${s.species}${s.isSinnohan ? '(S)' : ''} Lv.${s.level}`).join(', ')}`)
    const rematchLines = area.rematches.map((t) => `${t.name} (rematch): ${t.team.map((s) => `${s.species}${s.isSinnohan ? '(S)' : ''} Lv.${s.level}`).join(', ')}`)
    const bossLines = area.bosses.map((b) => `${b.name}: ${b.team.map((s) => `${s.species}${s.isSinnohan ? '(S)' : ''} Lv.${s.level}${s.item ? ` @ ${s.item}` : ''}${s.ability ? ` (${s.ability})` : ''} — ${s.moves.join(', ')}`).join(' | ')}`)
    return {
      id: `trainer-area-${slugify(area.area)}`,
      kind: 'trainer',
      title: area.area,
      subtitle: `${area.trainers.length} trainer${area.trainers.length === 1 ? '' : 's'}${area.bosses.length ? ` · ${area.bosses.length} detailed set${area.bosses.length === 1 ? '' : 's'}` : ''}`,
      body: text(area.area, trainerLines.join(' '), rematchLines.join(' '), bossLines.join(' ')),
      route: '#/trainers',
      badges: area.bosses.slice(0, 3).map((b) => b.name),
    }
  })
}

function wildRecords(areas) {
  return areas.map((area, index) => ({
    id: `wild-area-${slugify(area.area)}-${index}`,
    kind: 'wild',
    title: area.area,
    subtitle: area.levels || `${area.methods.length} encounter method${area.methods.length === 1 ? '' : 's'}`,
    body: text(
      area.area,
      area.levels,
      area.methods.map((m) => `${m.method}: ${m.slots.map((s) => `${s.species}${s.isSinnohan ? '(S)' : ''} ${s.percent}%`).join(', ')}`).join(' '),
    ),
    route: '#/wild',
    badges: area.methods.map((m) => m.method).slice(0, 4),
  }))
}

function eventRecords(events) {
  const records = []
  for (const section of events.sections) {
    section.items.forEach((item, index) => {
      records.push({
        id: `event-${slugify(section.title)}-${index}`,
        kind: 'event',
        title: item.title,
        subtitle: [section.title, item.location, item.level ? `Lv. ${item.level}` : null].filter(Boolean).join(' · '),
        body: text(item.title, section.title, item.location, item.level ? `level ${item.level}` : '', item.lines.join(' ')),
        route: '#/events',
        badges: [section.title],
      })
    })
  }
  return records
}

function guideRecords({ faq, npc, trades, levelCaps, actionReplay, documents }) {
  const records = []

  faq.forEach((entry, index) => {
    records.push({
      id: `faq-${index}`,
      kind: 'faq',
      title: entry.question.replace(/^Q:\s*/, ''),
      subtitle: 'FAQ',
      body: text(entry.question, entry.answer.join(' '), entry.subsections.map((s) => text(s.title, s.lines.join(' '))).join(' ')),
      route: '#/guides/faq',
      badges: [],
    })
  })

  npc.forEach((section, index) => {
    records.push({
      id: `npc-${index}`,
      kind: 'npc',
      title: section.title,
      subtitle: section.lines.find((l) => /^Location:/.test(l))?.replace(/^Location:\s*/, '') ?? 'NPC change',
      body: text(section.title, section.lines.join(' ')),
      route: '#/guides/npc',
      badges: [],
    })
  })

  trades.forEach((trade, index) => {
    records.push({
      id: `trade-${index}`,
      kind: 'trade',
      title: `${trade.city} trade`,
      subtitle: trade.species ? `For ${trade.species}` : 'In-game trade',
      body: text(trade.city, trade.request, trade.givenName, trade.species, trade.item, trade.ivs, trade.nature, trade.lines.join(' ')),
      route: '#/guides/trades',
      badges: [trade.species, trade.item].filter(Boolean),
    })
  })

  records.push({
    id: 'guide-level-caps',
    kind: 'guide',
    title: 'Level Caps',
    subtitle: `${levelCaps.length} entries`,
    body: text('level caps recommended levels', levelCaps.join(' ')),
    route: '#/guides/level-caps',
    badges: [],
  })

  actionReplay.forEach((section, index) => {
    records.push({
      id: `guide-action-replay-${index}`,
      kind: 'guide',
      title: `Action Replay: ${section.title}`,
      subtitle: 'Cheat codes',
      body: text('action replay cheat code', section.title, section.lines.join(' ')),
      route: '#/guides/action-replay',
      badges: [],
    })
  })

  for (const doc of documents) {
    records.push({
      id: `doc-${doc.id}`,
      kind: 'doc',
      title: doc.title,
      subtitle: doc.file,
      body: text(doc.title, doc.file, doc.summary, doc.generalNotes.map((n) => text(n.title, n.lines.join(' '))).join(' ')),
      route: doc.route,
      badges: [],
    })
  }

  return records
}

/** Build the full `SearchRecord[]`. */
export function buildSearchIndex(bundle) {
  const { pokemon, sinnohan, typeChanges, moves, items, evolutions, trainers, wild, events, misc, documents } = bundle

  return [
    ...pokemonRecords(pokemon),
    ...sinnohanRecords(sinnohan),
    ...typeRecords(typeChanges),
    ...moveRecords(moves),
    ...itemRecords(items),
    ...evolutionRecords(evolutions),
    ...trainerRecords(trainers.areas),
    ...wildRecords(wild.areas),
    ...eventRecords(events),
    ...guideRecords({
      faq: misc.faq,
      npc: misc.npc,
      trades: misc.trades,
      levelCaps: misc.levelCaps,
      actionReplay: misc.actionReplay,
      documents,
    }),
  ]
}
