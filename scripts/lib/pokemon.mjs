/**
 * pokemon.mjs — parsers for `PokemonChanges.txt` and `SinnohanForms.txt`.
 *
 * Both documents share the `rule / NNN - Name / rule` entry layout, so the
 * entry loop lives here for both; only the field handling differs.
 */

import {
  bodyLines,
  collapse,
  isBullet,
  parseStatBlock,
  rawSection,
  readOldNew,
  slugify,
  splitAbilities,
  splitMarkers,
  splitRuleSections,
  splitTypes,
  stripBullet,
} from './text.mjs'

/** Labels that open a sub-section inside a Pokémon entry. */
const POKEMON_LABELS = new Set([
  'Level Up',
  'Base Stats',
  'Type',
  'Ability',
  'Moves',
  'Evolution',
  'Base Happiness',
  'Gender Ratio',
  'Held Item',
])

/** Sinnohan entries additionally carry `Stats`, `TM` and `Tutor`. */
const SINNOHAN_LABELS = new Set([...POKEMON_LABELS, 'Stats', 'TM', 'Tutor'])

/**
 * Scope names the source uses as a **generic alias for the species itself**
 * rather than for one of its alternate forms.
 *
 * `Base Stats (Regular Form)` on Rotom is the clearest case: "Regular Form" is
 * not a form of Rotom at all, it is Rotom — the five appliance forms are the
 * alternates. Such a section describes the species, so it must populate the
 * entry's own `stats` / `ability` / `levelUp` / `moves`, never a variant (that
 * is what left Rotom's detail page with an empty stat comparison).
 *
 * This set is only half of the rule; the other half is the baseline-driven
 * "the scope names the species' *own* form" test (see `speciesScopeReason`), which
 * covers scopes that *are* real form names but name the default one —
 * `Plant Cloak` (Wormadam), `Normal Forme` (Deoxys), `Land Forme` (Shaymin).
 * The names below are the ones that are not form names at all, so no baseline
 * lookup can ever resolve them.
 *
 * `All Evolutions` (Eevee) is deliberately in neither half: it names a group of
 * *other* Pokémon and its block is a shared spread ("distributed differently"),
 * so it cannot be attributed to Eevee.
 */
const SPECIES_SCOPE_ALIASES = new Set([
  'Regular Form',
  'Regular Forme',
  'Normal Form',
  'Normal Forme',
  'Default Form',
  'Standard Form',
  'Base Form',
])

/* ------------------------------------------------------------------ */
/* Label matching                                                      */
/* ------------------------------------------------------------------ */

/**
 * Match a sub-section label line.
 *
 * Accepted shapes (all occur in the sources):
 *   `Ability:`            `Ability :`      (label spacing is inconsistent)
 *   `Ability;`                                (Torkoal, Deoxys)
 *   `Ability`                                 (Torkoal, no punctuation)
 *   `Base Stats(All Evolutions):`             (no space before the scope)
 *   `Level Up (Sky Forme):`                   (scoped)
 *
 * A bare label (no colon) must be *exactly* the label, which stops prose such
 * as `Catch Rate` or `Vanilla 70 HP / ...` from being mistaken for a heading.
 * Anything unrecognised is returned as `null` and kept as verbatim content.
 */
function matchLabel(raw, known) {
  const m = collapse(raw).match(/^([A-Za-z][A-Za-z ]*?)\s*(?:\(([^)]*)\))?\s*(?:([:;])\s*(.*))?$/)
  if (!m) return null
  const label = m[1].trim()
  if (!known.has(label)) return null
  const scope = m[2] ? m[2].trim() : null
  const inline = m[4] ? m[4].trim() : ''
  if (!m[3] && (scope || inline)) return null
  return { label, scope, inline, title: scope ? `${label} (${scope})` : label }
}

/**
 * Split an entry body into labelled sub-sections.
 * Non-label lines are appended to the section they follow; lines appearing
 * before the first label are returned in `pre` so nothing is dropped.
 */
function splitLabelled(lines, known) {
  const sections = []
  const pre = []
  let current = null
  for (const raw of lines) {
    const collapsed = collapse(raw)
    if (!collapsed) continue
    const label = matchLabel(raw, known)
    if (label) {
      current = { ...label, lines: label.inline ? [label.inline] : [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(collapsed)
    } else {
      pre.push(collapsed)
    }
  }
  return { pre, sections }
}

/* ------------------------------------------------------------------ */
/* Learnsets                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a level-up line: `LEVEL - Move`, optionally with `(!!)` / `(PLA)`
 * markers, and — inside Wormadam's cloak variants — an arrow replacement
 * (`1 - Leaf Storm >> Heat Wave (!!)`), where the *new* move is the one the
 * Pokémon actually learns and the left-hand name is what it replaced.
 */
function parseLearnEntry(text, log, file) {
  const collapsed = collapse(text)
  // Split on the literal ` - ` separator, never on bare move names: the source
  // contains both `Bubble` and `Bubble Beam`, and a name split would corrupt
  // the latter. The tolerant fallbacks only cover odd spacing.
  const dash = collapsed.indexOf(' - ')
  const [levelText, ...moveParts] =
    dash === -1 ? [null, null] : [collapsed.slice(0, dash), collapsed.slice(dash + 3)]
  if (levelText === null || !/^\d+$/.test(levelText.trim()) || !moveParts[0]) return null
  let rest = moveParts[0].trim()

  let replaces
  // ` >> ` is the replacement arrow, and is only ever a separator here.
  const arrow = rest.indexOf(' >> ')
  if (arrow !== -1) {
    replaces = rest.slice(0, arrow).trim()
    rest = rest.slice(arrow + 4).trim()
  }
  const { text: move, isNew, source, unknown } = splitMarkers(rest)
  for (const marker of unknown) {
    log.unparsedLine(file, text, `unrecognised marker (${marker}) on a level-up move`)
  }
  if (!move) return null
  const entry = { level: Number(levelText.trim()), move, isNew }
  if (source) entry.source = source
  if (replaces) entry.replaces = replaces
  return entry
}

/** `04 Calm Mind` / `HM01 Cut` -> `{ num: "04", move: "Calm Mind" }`. */
function parseTMLine(text) {
  const { text: body, isNew } = splitMarkers(text)
  const m = collapse(body).match(/^(HM\d{2}|\d{1,2})\s+(.+)$/)
  if (!m) return null
  const entry = { num: m[1].padStart(2, '0'), move: m[2].trim() }
  if (isNew) entry.isNew = true
  return entry
}

const emptyLearnset = () => ({ levelUp: [], tm: [], tutor: [] })

/* ------------------------------------------------------------------ */
/* PokemonChanges.txt                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse one `NNN - Name` entry from `PokemonChanges.txt`.
 * Returns `{ pokemon, forms }` where `forms` is keyed by form name.
 *
 * @param options.isDefaultFormScope `(dex, scope) => boolean` — true when `scope`
 *   names the species' **own** form (the form it has by default). Only the
 *   caller can answer that: it is a baseline fact (`isDefault` in PokeAPI's
 *   `pokemon-form` data), not something the documents state, so the predicate is
 *   injected by `scripts/build-data.mjs` from the cached baseline.
 */
function parsePokemonEntry(section, log, file, { isDefaultFormScope = () => false } = {}) {
  const { pre, sections } = splitLabelled(section.body, POKEMON_LABELS)

  const header = collapse(section.title).match(/^(\d{1,3})\s*-\s*(.+)$/)
  const dex = Number(header[1])
  const name = header[2].trim()

  /** @type {Map<string, object>} form name -> partial FormVariant */
  const formMap = new Map()
  const form = (formName) => {
    if (!formMap.has(formName)) formMap.set(formName, { form: formName })
    return formMap.get(formName)
  }

  /*
   * How many distinct form scopes each label declares in this entry. A label
   * with two or more scopes is a *parallel* per-form set (`Level Up (Normal
   * Forme)` / `(Attack Forme)` / …, Wormadam's three cloaks, Shaymin's two
   * formes): its members are sibling forms, so a *generic* alias
   * (`Regular Form`) can never be one of them — but the set may still contain
   * the species' own default form, which is promoted (see `speciesScopeReason`).
   */
  const scopesByLabel = new Map()
  for (const sub of sections) {
    if (!sub.scope) continue
    if (!scopesByLabel.has(sub.label)) scopesByLabel.set(sub.label, new Set())
    scopesByLabel.get(sub.label).add(sub.scope)
  }
  const scopeCount = (label) => scopesByLabel.get(label)?.size ?? 0

  /** @type {{dex: number, name: string, label: string, scope: string, reason: string}[]} */
  const promotions = []
  /**
   * Why a scoped section describes the species itself — `null` when it does not.
   * Such a section must fill the entry's own field instead of becoming a
   * pseudo-form variant. Two ways to qualify, checked in this order:
   *
   *  1. **The scope is the species' own default form** (`Plant Cloak` on
   *     Wormadam, `Normal Forme` on Deoxys, `Land Forme` on Shaymin). This wins
   *     even inside a parallel set: the sibling scopes are the alternates, this
   *     one is the species. Promoted sections are exactly the ones the entry
   *     would otherwise hide behind a form card — which is what left Wormadam's
   *     page with no stats, no ability and no documented learnset of its own.
   *  2. **The scope is a generic alias** for the species (`Regular Form` on
   *     Rotom). That name is not a form of any kind, so it is only trusted when
   *     the entry declares a single scope for the label; with two or more, the
   *     block is a deliberate per-form breakdown and `Regular Form` would be an
   *     odd way to name one of its members.
   */
  const speciesScopeReason = (label, scope, declaredScopes) => {
    if (!scope) return null
    if (isDefaultFormScope(dex, scope)) return 'species-default-form'
    if (!SPECIES_SCOPE_ALIASES.has(scope)) return null
    return declaredScopes > 1 ? null : 'species-alias'
  }
  const recordPromotion = (label, scope, reason) => {
    promotions.push({ dex, name, label, scope, reason })
  }
  /**
   * Route one labelled sub-section to the entry's own field or to its form
   * variant. Nothing is recorded until the value actually lands, so the
   * promotion report never lists a section whose body failed to parse.
   */
  const routeScoped = (sub, assignSpecies, assignForm) => {
    const reason = sub.scope ? speciesScopeReason(sub.label, sub.scope, scopeCount(sub.label)) : null
    if (reason) {
      recordPromotion(sub.label, sub.scope, reason)
      assignSpecies()
    } else if (sub.scope) {
      assignForm(sub.scope)
    } else {
      assignSpecies()
    }
  }

  /**
   * Report the Old/New lines a field parser could not represent.
   * They remain in `sections[]`; this only drives the "unparsed" audit.
   * Lines already re-routed elsewhere (see `relocated`) are not reported.
   */
  const leftover = (pair, reason) => {
    for (const other of pair.others) {
      if (!relocated.has(collapse(other))) log.unparsedLine(file, other, reason)
    }
    for (const extra of pair.extra) {
      if (!relocated.has(extra.raw)) log.unparsedLine(file, extra.raw, reason)
    }
  }

  /*
   * `Now compatible with …` is a `Moves:` line, but dex 232 (Donphan) writes one
   * directly under `Base Stats :` with no `Moves:` heading at all. It documents a
   * real compatibility (TM47 Iron Head), so it is re-routed into `moves[]` from
   * wherever it appears; the raw section still keeps the line verbatim.
   */
  const relocatedLines = []
  const relocated = new Set()
  for (const sub of sections) {
    if (sub.label === 'Moves') continue
    for (const line of sub.lines) {
      const collapsed = collapse(line)
      if (!/^Now compatible with .+\.(\s*\((!!|PLA)\))?$/.test(collapsed)) continue
      if (relocated.has(collapsed)) continue
      relocated.add(collapsed)
      relocatedLines.push(collapsed)
    }
  }

  const learnset = emptyLearnset()
  const moves = []
  const evolution = []
  let type
  let stats
  let ability
  let heldItem
  let baseHappiness
  let genderRatio
  let sinnohanMarker = false

  for (const sub of sections) {
    const lines = sub.lines
    switch (sub.label) {
      case 'Type': {
        const pair = readOldNew(lines)
        if (pair.old !== null && pair.new !== null && !pair.duplicateOld) {
          type = { old: splitTypes(pair.old), new: splitTypes(pair.new) }
        }
        // Rotom's Type section is prose ("All of Rotom's formes match their
        // types as of Gen V.") — no typed field, but the line is preserved.
        leftover(pair, 'Type section line without an Old/New pair')
        break
      }
      case 'Base Stats': {
        const pair = readOldNew(lines)
        const oldBlock = pair.old ? parseStatBlock(pair.old) : null
        const newBlock = pair.new ? parseStatBlock(pair.new) : null
        if (pair.duplicateOld) {
          log.warn(`${section.title}: "Base Stats" repeats the "Old" prefix; the second line was read as "New"`)
        }
        if (oldBlock && newBlock) {
          const value = { old: oldBlock, new: newBlock }
          routeScoped(
            sub,
            () => { stats = value },
            (scope) => { form(scope).stats = value },
          )
        }
        leftover(pair, 'Base Stats section line that is not a stat block (e.g. the `Catch Rate` block)')
        break
      }
      case 'Ability': {
        const pair = readOldNew(lines)
        if (pair.duplicateOld) {
          log.warn(`${section.title}: "Ability" repeats the "Old" prefix; the second line was read as "New"`)
        }
        if (pair.old !== null && pair.new !== null) {
          const value = { old: splitAbilities(pair.old), new: splitAbilities(pair.new) }
          routeScoped(
            sub,
            () => { ability = value },
            (scope) => { form(scope).ability = value },
          )
        }
        /*
         * Wormadam annotates each cloak with `New(Plant Cloak) ...` inside the
         * shared Ability section (one form-neutral `Old` line, three scoped
         * `New` lines). The scopes are a parallel per-form set, but the one that
         * names the species' own cloak still belongs to the entry, so
         * `Plant Cloak` fills `PokemonChange.ability` and only the two genuine
         * alternate cloaks become variants.
         */
        const scopedLineScopes = new Set(pair.scoped.map((entry) => entry.scope))
        for (const entry of pair.scoped) {
          const value = {
            old: pair.old !== null ? splitAbilities(pair.old) : [],
            new: splitAbilities(entry.value),
          }
          const reason = speciesScopeReason('Ability', entry.scope, scopedLineScopes.size)
          if (reason) {
            recordPromotion('Ability', entry.scope, reason)
            ability = value
          } else {
            form(entry.scope).ability = value
          }
        }
        leftover(pair, 'Ability section line without an Old/New pair')
        break
      }
      case 'Base Happiness': {
        const pair = readOldNew(lines)
        if (pair.new !== null) baseHappiness = pair.new
        leftover(pair, 'Base Happiness section line without an Old/New pair')
        break
      }
      case 'Gender Ratio': {
        const pair = readOldNew(lines)
        if (pair.new !== null) genderRatio = pair.new
        leftover(pair, 'Gender Ratio section line without an Old/New pair')
        break
      }
      case 'Held Item': {
        const pair = readOldNew(lines)
        const value = pair.new ?? (pair.others.length ? pair.others.join(' ') : null)
        if (value) heldItem = value
        // `others` *is* the value here (Giratina's prose line), so only the
        // Old/New leftovers are unconsumed.
        for (const extra of pair.extra) log.unparsedLine(file, extra.raw, 'Held Item section extra line')
        break
      }
      case 'Moves': {
        const notes = []
        for (const line of lines) {
          const { text, isNew, source } = splitMarkers(line)
          const note = { text, isNew }
          if (source) note.source = source
          notes.push(note)
        }
        routeScoped(
          sub,
          () => moves.push(...notes),
          (scope) => { form(scope).moves = notes },
        )
        break
      }
      case 'Level Up': {
        const entries = []
        for (const line of lines) {
          const entry = parseLearnEntry(line, log, file)
          if (entry) entries.push(entry)
          else log.unparsedLine(file, line, 'Level Up line that is not `LEVEL - Move`')
        }
        routeScoped(
          sub,
          () => learnset.levelUp.push(...entries),
          (scope) => { form(scope).levelUp = entries },
        )
        break
      }
      case 'Evolution': {
        for (const line of lines) evolution.push(isBullet(line) ? stripBullet(line) : line)
        break
      }
      default:
        break
    }
  }

  if (pre.length) {
    for (const line of pre) {
      if (line === 'Sinnohan Form.' || line.startsWith('See SinnohanForms.txt')) sinnohanMarker = true
      else if (/^Now compatible with .+\.(\s*\((!!|PLA)\))?$/.test(line)) relocatedLines.push(line)
      else log.unparsedLine(file, line, 'entry preamble line')
    }
  }

  // Compatibility lines that were not under a `Moves:` heading still belong to
  // the entry's `moves[]` notes.
  for (const line of relocatedLines) {
    const { text, isNew, source } = splitMarkers(line)
    const note = { text, isNew }
    if (source) note.source = source
    moves.push(note)
  }

  const forms = [...formMap.values()].map((f) => ({
    form: f.form,
    ...(f.ability ? { ability: f.ability } : {}),
    ...(f.stats ? { stats: f.stats } : {}),
    ...(f.moves ? { moves: f.moves } : {}),
    ...(f.levelUp ? { levelUp: f.levelUp } : {}),
  }))

  const isSinnohan = /sinnohan|\(S\)/i.test(name) || sinnohanMarker

  const changeKinds = []
  if (type) changeKinds.push('type')
  if (stats) changeKinds.push('stats')
  if (ability) changeKinds.push('ability')
  if (moves.length) changeKinds.push('moves')
  if (learnset.levelUp.length || learnset.tm.length || learnset.tutor.length) changeKinds.push('learnset')
  if (evolution.length) changeKinds.push('evolution')
  if (heldItem) changeKinds.push('item')
  /*
   * A Sinnohan form is a *regional variant*: it replaces the species outright
   * rather than tweaking it. Labelling it `other` made the UI fall back to
   * "Autre"/"Other", which tells the reader nothing. `form` renders as
   * "Forme régionale" / "Regional form" and gets its own tone.
   */
  if (isSinnohan) changeKinds.push('form')
  if (forms.some((f) => f.stats) && !changeKinds.includes('stats')) changeKinds.push('stats')
  if (forms.some((f) => f.ability) && !changeKinds.includes('ability')) changeKinds.push('ability')
  if (forms.some((f) => f.moves?.length) && !changeKinds.includes('moves')) changeKinds.push('moves')
  if (forms.some((f) => f.levelUp?.length) && !changeKinds.includes('learnset')) changeKinds.push('learnset')
  if (baseHappiness || genderRatio) changeKinds.push('other')
  if (!changeKinds.length) changeKinds.push('other')

  const rawSections = []
  if (pre.length) rawSections.push({ title: name, lines: pre })
  for (const sub of sections) {
    rawSections.push(rawSection(sub.title, sub.lines))
  }

  return {
    pokemon: {
      dex,
      name,
      slug: slugify(name),
      isSinnohan,
      changeKinds,
      ...(type ? { type } : {}),
      ...(stats ? { stats } : {}),
      ...(ability ? { ability } : {}),
      moves,
      learnset,
      evolution,
      ...(heldItem ? { heldItem } : {}),
      ...(baseHappiness ? { baseHappiness } : {}),
      ...(genderRatio ? { genderRatio } : {}),
      forms,
      sections: rawSections,
    },
    promotions,
  }
}

/**
 * Parse `PokemonChanges.txt`.
 *
 * @param options.isDefaultFormScope `(dex, scope) => boolean` — the baseline
 *   half of the species-scope rule; see `parsePokemonEntry`.
 * Returns `{ generalNotes, entries, promotions }` — `generalNotes` is every prose
 * section that precedes the per-Pokémon entries, and `promotions` records every
 * form-scoped section that was read as species-level — `Base Stats (Regular
 * Form)` on Rotom (the scope is an alias for the species) and `Plant Cloak`,
 * `Normal Forme`, `Land Forme` (the scope is the species' own default form) — so
 * the build can report the decision.
 */
export function parsePokemonChanges(lines, log, file, options = {}) {
  const { sections } = splitRuleSections(lines)
  const generalNotes = []
  const entries = []
  const coverage = []
  const promotions = []

  // The 5-line ASCII banner (`o---o` / `| Pokémon Changes (r1.0.5) |`) is pure
  // framing: its words are already in `meta.json` as `hack`, `version`,
  // `originalAuthor` and `documents[].title`/`version`.
  for (const section of sections) {
    if (/^\d{1,3}\s*-\s*.+$/.test(collapse(section.title))) {
      const parsed = parsePokemonEntry(section, log, file, options)
      entries.push(parsed.pokemon)
      promotions.push(...parsed.promotions)
      coverage.push(rawCoverage(section, parsed.pokemon.sections))
    } else {
      generalNotes.push(rawSection(section.title, section.body))
    }
  }

  return { generalNotes, entries, coverage, promotions }
}

/**
 * How much of an entry's raw body the emitted `RawSection[]` accounts for.
 * The build asserts that no entry loses source lines to the parser.
 */
function rawCoverage(section, rawSections) {
  const nonBlank = bodyLines(section.body).length
  // Every label line becomes a section *title*, so titles count as coverage.
  const covered = rawSections.reduce((n, s) => n + s.lines.length, 0) + rawSections.length
  return { title: collapse(section.title), nonBlank, covered }
}

/* ------------------------------------------------------------------ */
/* SinnohanForms.txt                                                   */
/* ------------------------------------------------------------------ */

/** Parse one `NNN - Sinnohan Foo` entry. */
function parseSinnohanEntry(section, log, file) {
  const { pre, sections } = splitLabelled(section.body, SINNOHAN_LABELS)

  const header = collapse(section.title).match(/^(\d{1,3})\s*-\s*(.+)$/)
  const dex = Number(header[1])
  const rawName = header[2].trim()
  // Dex 309/310 (Electrike, Manectric) are missing the `Sinnohan ` prefix even
  // though they are Sinnohan forms — normalise it back in.
  const baseName = rawName.replace(/^Sinnohan\s+/i, '').trim()
  const name = `Sinnohan ${baseName}`

  const learnset = emptyLearnset()
  const evolution = []
  let types = []
  let abilities = []
  let stats

  for (const sub of sections) {
    switch (sub.label) {
      case 'Type':
        types = splitTypes(sub.lines[0] ?? '')
        for (const extra of sub.lines.slice(1)) log.unparsedLine(file, extra, 'extra Sinnohan `Type:` line')
        break
      case 'Ability':
        abilities = splitAbilities(sub.lines[0] ?? '')
        for (const extra of sub.lines.slice(1)) log.unparsedLine(file, extra, 'extra Sinnohan `Ability:` line')
        break
      case 'Stats': {
        for (const extra of sub.lines.slice(1)) log.unparsedLine(file, extra, 'extra Sinnohan `Stats:` line')
        const block = parseStatBlock(sub.lines[0] ?? '')
        if (block) stats = block
        else log.unparsedLine(file, sub.lines[0] ?? sub.title, 'Sinnohan `Stats:` line that is not a stat block')
        break
      }
      case 'Evolution':
        for (const line of sub.lines) evolution.push(isBullet(line) ? stripBullet(line) : line)
        break
      case 'Level Up':
        for (const line of sub.lines) {
          const entry = parseLearnEntry(line, log, file)
          if (entry) learnset.levelUp.push(entry)
          else log.unparsedLine(file, line, 'Level Up line that is not `LEVEL - Move`')
        }
        break
      case 'TM':
        for (const line of sub.lines) {
          const tm = parseTMLine(line)
          if (tm) learnset.tm.push(tm)
          else log.unparsedLine(file, line, 'TM line that is not `NN Move`')
        }
        break
      case 'Tutor':
        for (const line of sub.lines) {
          // rev 2: a tutor entry is an object, not a bare move name.
          const { text, isNew } = splitMarkers(line)
          if (!text) continue
          learnset.tutor.push(isNew ? { move: text, isNew: true } : { move: text })
        }
        break
      default:
        break
    }
  }

  for (const line of pre) log.unparsedLine(file, line, 'Sinnohan entry preamble line')

  const rawSections = []
  if (pre.length) rawSections.push({ title: name, lines: pre })
  for (const sub of sections) rawSections.push(rawSection(sub.title, sub.lines))

  return {
    dex,
    name,
    baseName,
    slug: slugify(name),
    types,
    abilities,
    stats: stats ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, bst: 0 },
    evolution,
    learnset,
    sections: rawSections,
  }
}

/** Parse `SinnohanForms.txt`. */
export function parseSinnohanForms(lines, log, file) {
  const { sections } = splitRuleSections(lines)
  const generalNotes = []
  const entries = []
  const coverage = []

  for (const section of sections) {
    if (/^\d{1,3}\s*-\s*.+$/.test(collapse(section.title))) {
      const form = parseSinnohanEntry(section, log, file)
      entries.push(form)
      coverage.push(rawCoverage(section, form.sections))
    } else {
      generalNotes.push(rawSection(section.title, section.body))
    }
  }

  return { generalNotes, entries, coverage }
}
