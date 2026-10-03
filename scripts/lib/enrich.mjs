/**
 * enrich.mjs — completes the hack's documents with the vanilla **Platinum**
 * baseline.
 *
 * The rule that governs every merge below is the first one in
 * `docs/DATA-SCHEMA.md`: **documented values always win.** The baseline only
 * ever fills a hole, and every value it contributes is traceable:
 *
 *  - `PokemonChange.baseTypes`      + `baseTypesSource: "baseline"`  (rev 3)
 *  - `PokemonChange.baseStats`      + `baseStatsSource: "baseline"`
 *  - `learnset.tm` / `learnset.tutor` + `includesBaseline: true`
 *  - `learnset.levelUp` (only when the entry documents none)
 *  - `SinnohanForm.replacedTypes` / `replacedStats` (vanilla base species)
 *  - `FormVariant.types` (the alternate forms' own typing)           (rev 3)
 *
 * The `Moves:` sections are also where the hack states *new compatibilities*
 * (`Now compatible with TM88, Hurricane. (!!)`, `… from the Move Tutor. (!!)`).
 * Those lines used to land in `moves[]` notes only, which is why every TM and
 * tutor list stayed empty; they are now parsed into `learnset.tm` /
 * `learnset.tutor` with `isNew` mirroring the source's `(!!)` marker, *in
 * addition* to staying verbatim in `moves[]`.
 *
 * rev 3 also adds the two checks in `crossCheckTypes()`: the Sinnohan forms'
 * documented typing against the baseline's Gen-IV typing of the species they
 * replace, and `TypeChanges.txt`'s stated `Old` types against the same baseline.
 * Both are *review* lists — the documents legitimately do full retypes, and the
 * source's `Old` column is sometimes a later generation's typing — so they are
 * printed, not asserted. Only the mechanical invariants are hard assertions.
 */

/* ------------------------------------------------------------------ */
/* Move-name helpers                                                   */
/* ------------------------------------------------------------------ */

/** Comparison key: case and punctuation insensitive (`U-turn` = `U-Turn`). */
export const moveKey = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The spelling the hack's documents use for every move they mention, keyed by
 * `moveKey`. PokeAPI's English name is canonical but not always identical
 * (`Feint Attack` vs the documents' `Faint Attack`), so a baseline name that
 * the documents also use is written the documents' way — that keeps list
 * entries and cross-links consistent with the rest of the site.
 */
export function buildDocMoveVocabulary({ pokemon = [], sinnohan = [], moves = null, items = null } = {}) {
  const vocab = new Map()
  const add = (name) => {
    const text = String(name ?? '').trim()
    const key = moveKey(text)
    if (key && !vocab.has(key)) vocab.set(key, text)
  }

  for (const entry of pokemon) {
    for (const learn of entry.learnset?.levelUp ?? []) add(learn.move)
    for (const form of entry.forms ?? []) {
      for (const learn of form.levelUp ?? []) add(learn.move)
    }
  }
  for (const form of sinnohan) {
    for (const learn of form.learnset?.levelUp ?? []) add(learn.move)
    for (const tm of form.learnset?.tm ?? []) add(tm.move)
    for (const tutor of form.learnset?.tutor ?? []) add(tutor.move)
  }
  for (const row of items?.tmLocations ?? []) add(row.move)
  for (const row of items?.tmChanges ?? []) add(row.move)
  for (const row of moves?.replacements ?? []) {
    add(row.oldMove)
    add(row.newMove)
  }
  for (const move of moves?.newMoves ?? []) add(move.name)
  for (const mod of [...(moves?.modifications ?? []), ...(moves?.groupModifications ?? [])]) {
    for (const name of mod.moves ?? []) add(name)
  }

  return vocab
}

/** The hack's own `TM/HM slot -> move` table, from `ItemChanges.txt`. */
export function buildHackTmTable(items) {
  const table = new Map()
  for (const row of items?.tmLocations ?? []) table.set(String(row.tm).toUpperCase(), row.move)
  for (const row of items?.tmChanges ?? []) table.set(String(row.tm).toUpperCase(), row.move)
  return table
}

/* ------------------------------------------------------------------ */
/* `Moves:` compatibility lines                                        */
/* ------------------------------------------------------------------ */

/**
 * The four shapes the documents use, once `splitMarkers` has removed the
 * trailing `(!!)` / `(PLA)` annotation into `MoveNote.isNew` / `.source`:
 *
 *   Now compatible with TM88, Hurricane.               -> TM entry (num "88")
 *   Now compatible with HM01, Cut.                     -> HM entry (num "HM01")
 *   Now compatible with HMN, Cut.                      -> HM entry, unnumbered
 *   Now compatible with Draco Meteor from the Move Tutor.  -> tutor entry
 *   Now compatible with all TMs and HMs.               -> note only
 *
 * Anything that does not match stays a note in `moves[]` untouched.
 */
export function parseCompatNote(note) {
  const text = String(note?.text ?? '').trim()
  const match = text.match(/^Now compatible with (.+?)\.$/)
  if (!match) return null
  const body = match[1].trim()
  const isNew = note.isNew === true
  const base = { isNew, ...(note.source ? { source: note.source } : {}) }

  if (/^all TMs and HMs$/i.test(body)) return { kind: 'note', text, ...base }

  const tutor = body.match(/^(.+?) from the Move Tutor$/i)
  if (tutor) return { kind: 'tutor', move: tutor[1].trim(), ...base }

  const machine = body.match(/^((?:TM|HM)[A-Za-z]?[0-9]{0,2})\s*,\s*(.+)$/i)
  if (machine) {
    const slot = machine[1].toUpperCase()
    return { kind: 'tm', slot, num: tmNum(slot), move: machine[2].trim(), ...base }
  }

  return null
}

/**
 * `TM`/`HM` slot label -> the `TMLearn.num` spelling the contract uses:
 * `TM88` -> `"88"` (zero-padded), `HM01` -> `"HM01"`, `HMN` -> `"HMN"`.
 */
export function tmNum(slot) {
  const match = String(slot).toUpperCase().match(/^(TM|HM)(.*)$/)
  if (!match) return String(slot)
  const [, prefix, rest] = match
  if (prefix === 'HM') return /^\d+$/.test(rest) ? `HM${rest.padStart(2, '0')}` : `HM${rest}`
  return /^\d+$/.test(rest) ? rest.padStart(2, '0') : rest
}

/** Split an entry's `Moves:` notes into compat entries plus the notes left over. */
export function parseCompatNotes(notes) {
  const tms = []
  const tutors = []
  const notesOnly = []
  const leftover = []
  const seenTm = new Set()
  const seenTutor = new Set()

  for (const note of notes ?? []) {
    const parsed = parseCompatNote(note)
    if (!parsed) {
      leftover.push(note)
      continue
    }
    if (parsed.kind === 'note') {
      notesOnly.push(parsed)
      continue
    }
    if (parsed.kind === 'tm') {
      if (seenTm.has(parsed.slot)) continue
      seenTm.add(parsed.slot)
      tms.push(parsed)
    } else if (parsed.kind === 'tutor') {
      const key = moveKey(parsed.move)
      if (seenTutor.has(key)) continue
      seenTutor.add(key)
      tutors.push(parsed)
    }
  }

  return { tms, tutors, notesOnly, leftover }
}

/* ------------------------------------------------------------------ */
/* Types (rev 3)                                                       */
/* ------------------------------------------------------------------ */

/** The `PType` spellings `src/types/data.ts` accepts. */
export const POKEMON_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', '???',
]

const TYPE_SET = new Set(POKEMON_TYPES)

/** Same list, in order, ignoring case and punctuation. */
export const sameTypeList = (a = [], b = []) =>
  a.length === b.length && a.every((type, i) => moveKey(type) === moveKey(b[i]))

/** `true` for a non-empty list of valid `PType` names. */
export const isValidTypeList = (types) =>
  Array.isArray(types) && types.length > 0 && types.every((type) => TYPE_SET.has(type))

/* ------------------------------------------------------------------ */
/* Alternate forms (rev 3)                                             */
/* ------------------------------------------------------------------ */

/**
 * The form token of a `pokemon-form` slug: `rotom-fan` -> `fan`,
 * `deoxys-normal` -> `normal`, `wormadam-plant` -> `plant`. A slug with no
 * suffix (`rotom`, `castform`) is the species' *default* form and yields `''`,
 * which never matches a document scope — the default form's typing is the
 * species' typing, i.e. `baseTypes`.
 */
function formToken(slug) {
  const dash = String(slug).indexOf('-')
  return dash === -1 ? '' : String(slug).slice(dash + 1)
}

/**
 * Resolve a document form scope (`Fan Rotom`, `Plant Cloak`, `Normal Forme`)
 * against the species' baseline forms.
 *
 * The join cannot use the names directly: the documents write `Plant Cloak`
 * where PokeAPI writes `Plant Wormadam`, and `Normal Forme` where it writes
 * `Normal Deoxys`. The documents' names always contain the form token
 * (`plantcloak` ⊃ `plant`, `normalforme` ⊃ `normal`), so the token is the join
 * key. Ambiguity is never guessed: `null` is returned and reported instead.
 */
export function matchFormScope(baseForms, scope) {
  const key = moveKey(scope)
  if (!key) return null
  const matches = baseForms.filter((form) => {
    const token = formToken(form.slug)
    return token.length >= 3 && key.includes(token)
  })
  return matches.length === 1 ? matches[0] : null
}

/**
 * True when a document form scope names the species' **own** form — the one it
 * has by default (`isDefault`, i.e. PokeAPI's unsuffixed `pokemon` entry:
 * `wormadam-plant` for `Plant Cloak`, `deoxys-normal` for `Normal Forme`,
 * `shaymin-land` for `Land Forme`).
 *
 * This is the second half of the species-scope rule in `scripts/lib/pokemon.mjs`
 * and it is deliberately *baseline-driven*: the documents never say which cloak
 * is Wormadam's base form, but the vanilla data does, and the pipeline already
 * treats the default form as the species everywhere else (`baseTypes` and
 * `baseStats` are read from it). `Rotom`'s `Regular Form` is the other half —
 * a scope that is not a form name at all — and is matched by name instead.
 */
export function matchesDefaultForm(baseForms, scope) {
  const form = matchFormScope(baseForms, scope)
  return Boolean(form?.isDefault)
}

/** Display label for a baseline form the documents never mention. */
function formLabel(form) {
  if (form.name) return form.name
  const token = formToken(form.slug)
  return token ? titleCaseSlug(token) : titleCaseSlug(form.slug)
}

/** Minimal title-case fallback for a `pokemon-form` slug with no English name. */
function titleCaseSlug(slug) {
  return String(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** The note the pipeline adds to every entry whose alternate forms exist. */
export const FORM_CHANGE_SECTION_TITLE = 'Form Change (pipeline note)'
export const FORM_CHANGE_SECTION_LINES = [
  'Pipeline note — not source text: this species has alternate forms, but none of the 14 documents',
  'describes how to change form. There is no Secret Key, Gracidea, appliance, Rotom Room or other',
  'form-change section anywhere in the corpus, so the mechanism is deliberately left undocumented',
  'here rather than invented. SpecialEvents.txt records where the Pokémon is obtained — see events.json.',
]

/**
 * Give every alternate form a typing.
 *
 *  - a form the documents scope (`Ability (Fan Rotom)`, `Level Up (Sky Forme)`)
 *    keeps the document's label and gains the baseline's `types`;
 *  - a form the documents never mention but the baseline knows (Castform's
 *    weather forms, Burmy's cloaks, Giratina's Origin Forme, …) is added with
 *    the baseline's English name and its `types`, so the forms list is complete;
 *  - the species' **default** form is never added as a variant: it *is* the
 *    species, and its typing is `baseTypes`.
 */
function attachFormTypes(entry, baseForms, counts, log) {
  if (baseForms.length === 0) return

  const matched = new Map()
  const unmatched = []
  for (const variant of entry.forms) {
    const form = matchFormScope(baseForms, variant.form)
    if (form) matched.set(form.slug, variant)
    else unmatched.push(variant)
  }
  for (const variant of unmatched) {
    log?.warn(
      `${String(entry.dex).padStart(3, '0')} - ${entry.name}: form "${variant.form}" matches no single ` +
        'vanilla form — the document label is kept and no types are attached',
    )
  }

  const ordered = []
  for (const form of baseForms) {
    const variant = matched.get(form.slug)
    if (variant) {
      variant.types = [...form.types]
      counts.formTypesFromDocument++
      ordered.push(variant)
      continue
    }
    if (form.isDefault) continue
    ordered.push({ form: formLabel(form), types: [...form.types] })
    counts.formsSynthesized++
  }

  // A document variant that matches no baseline form stays, in source order.
  entry.forms = [...ordered, ...unmatched]
}

/* ------------------------------------------------------------------ */
/* Type cross-checks (rev 3)                                           */
/* ------------------------------------------------------------------ */

/**
 * How a Sinnohan form's documented typing relates to the species it replaces.
 * Every one of these is legitimate — the hack retypes its regional forms from
 * scratch — so the value is a *review* label, never an error.
 */
function typeRelation(base, next) {
  if (base.length === 0 || next.length === 0) return 'unresolved'
  const shared = next.filter((type) => base.includes(type))
  if (shared.length === 0) return 'full-retype'
  if (next.length < base.length && shared.length === next.length) return 'subset'
  if (next.length > base.length && shared.length === base.length) return 'superset'
  if (base.length === next.length && shared.length === base.length) return 'identical'
  return 'partial-overlap'
}

/**
 * The two systematic type cross-checks of rev 3.
 *
 * 1. **Sinnohan forms** — `replacedTypes` (baseline Gen-IV) against the form's
 *    documented `types`. Full retypes are expected, so the list is printed for
 *    review rather than asserted.
 * 2. **`TypeChanges.txt`** — the table states both the `Old` and the `New` type
 *    explicitly, so the document's `Old` must equal the baseline's Gen-IV typing
 *    for that dex. A disagreement is a genuine finding: the row's `Old` is
 *    either an *earlier* generation's typing (a pre-Gen-IV retcon) or a *later*
 *    one (the Gen-VI Fairy retcon — `Granbull` is `Normal` in Platinum and
 *    `Fairy` today), and the document must not be silently "corrected".
 */
export function crossCheckTypes({ pokemon, sinnohan, typeChanges, baseline }) {
  const sinnohanRows = sinnohan.map((form) => {
    const base = form.replacedTypes ?? []
    const next = form.types ?? []
    return {
      dex: form.dex,
      name: form.name,
      replacedTypes: [...base],
      types: [...next],
      relation: typeRelation(base, next),
    }
  })

  const documentRows = (typeChanges?.pokemonChanges ?? []).map((entry) => {
    const base = baseline.at(entry.dex)
    const genFour = base?.types ?? []
    const current = base?.currentTypes ?? []
    const matchesBaseline = sameTypeList(entry.oldTypes, genFour)
    let diagnosis = 'matches vanilla Platinum (Gen IV)'
    if (!matchesBaseline) {
      if (sameTypeList(entry.oldTypes, current)) diagnosis = 'document states the modern (Gen VI+) typing'
      else if (base) diagnosis = 'document states neither the Gen-IV nor the current typing'
      else diagnosis = 'no baseline for this dex'
    }
    return {
      dex: entry.dex,
      name: entry.name,
      documentOld: [...entry.oldTypes],
      documentNew: [...entry.newTypes],
      baselineGenFour: [...genFour],
      baselineCurrent: [...current],
      matchesBaseline,
      diagnosis,
    }
  })

  /* Does PokemonChanges.txt agree with TypeChanges.txt about the new typing? */
  const consistency = (typeChanges?.pokemonChanges ?? [])
    .map((entry) => {
      const change = pokemon.find((p) => p.dex === entry.dex)
      if (!change?.type) return null
      return {
        dex: entry.dex,
        name: change.name,
        fromDocument: [...entry.newTypes],
        fromPokemonChanges: [...change.type.new],
        agrees: sameTypeList(entry.newTypes, change.type.new),
      }
    })
    .filter(Boolean)

  return { sinnohanRows, documentRows, consistency }
}

/* ------------------------------------------------------------------ */
/* Enrichment                                                          */
/* ------------------------------------------------------------------ */

const clone = (value) => JSON.parse(JSON.stringify(value))

/**
 * Fill one learnset from the baseline, then merge what the documents add.
 *
 * @param learnset      document-parsed learnset (mutated in place)
 * @param base          baseline entry for this dex (may be null)
 * @param compat        `parseCompatNotes()` result of the entry's `Moves:` notes
 * @param documentsOwn  true when the source already documents a *complete* list
 *                      (Sinnohan forms do) — the baseline is then only used to
 *                      fill an empty list, never merged into a non-empty one.
 */
function fillLearnset(learnset, base, compat, { baseline, spell, hackTmTable, log, who, documentsOwn = false }) {
  const filled = { tm: 0, tutor: 0, levelUp: 0 }
  const stats = { tmNoSlot: 0, slotNameMismatch: 0 }

  const displayMove = (slug, slot) => {
    const hackName = slot ? hackTmTable.get(slot) : undefined
    if (hackName) return hackName
    return baseline.moveName(slug)
  }

  /* ---- level-up -------------------------------------------------- */
  if (learnset.levelUp.length === 0 && base && base.levelUp.length > 0) {
    learnset.levelUp = base.levelUp.map((entry) => ({
      level: entry.level,
      move: spell(entry.slug),
      isNew: false,
    }))
    filled.levelUp = learnset.levelUp.length
  }

  /* ---- TM/HM ----------------------------------------------------- */
  if (learnset.tm.length === 0 || !documentsOwn) {
    const merged = []
    const bySlot = new Map()
    for (const slug of base?.machine ?? []) {
      const slot = baseline.tmTable.slugToSlot[slug]
      if (!slot) {
        stats.tmNoSlot++
        continue
      }
      if (bySlot.has(slot)) continue
      const entry = { num: tmNum(slot), move: displayMove(slug, slot) }
      bySlot.set(slot, entry)
      merged.push(entry)
    }
    filled.tm = merged.length

    for (const doc of compat.tms) {
      const existing = bySlot.get(doc.slot)
      if (existing) {
        // The document states this compatibility explicitly: it wins, and its
        // `(!!)` marker decides `isNew`.
        if (existing.move !== doc.move) {
          stats.slotNameMismatch++
          log?.warn(
            `${who}: "Moves:" says ${doc.slot} is "${doc.move}" but the baseline maps that slot to ` +
              `"${existing.move}" — the documented name wins`,
          )
        }
        existing.move = doc.move
        if (doc.isNew) existing.isNew = true
        continue
      }
      const entry = { num: doc.num, move: doc.move }
      if (doc.isNew) entry.isNew = true
      bySlot.set(doc.slot, entry)
      merged.push(entry)
    }
    learnset.tm = merged
  }

  /* ---- move tutor ------------------------------------------------ */
  if (learnset.tutor.length === 0 || !documentsOwn) {
    const merged = []
    const byName = new Map()
    for (const slug of base?.tutor ?? []) {
      const name = spell(slug)
      const key = moveKey(name)
      if (byName.has(key)) continue
      const entry = { move: name }
      byName.set(key, entry)
      merged.push(entry)
    }
    filled.tutor = merged.length

    for (const doc of compat.tutors) {
      const key = moveKey(doc.move)
      const existing = byName.get(key)
      if (existing) {
        if (doc.isNew) existing.isNew = true
        continue
      }
      const entry = { move: doc.move }
      if (doc.isNew) entry.isNew = true
      byName.set(key, entry)
      merged.push(entry)
    }
    learnset.tutor = merged
  }

  return { filled, stats }
}

/**
 * Enrich `pokemon.json` and `sinnohan.json` in place; returns the counters
 * `meta.enrichment` reports.
 */
export function enrichAll({ pokemon, sinnohan, baseline, items, moves, log }) {
  const vocabulary = buildDocMoveVocabulary({ pokemon, sinnohan, moves, items })
  /** Baseline slug -> display name, preferring the spelling the documents use. */
  const spell = (slug) => {
    const pokeName = baseline.moveName(slug)
    return vocabulary.get(moveKey(pokeName)) ?? pokeName
  }

  const hackTmTable = buildHackTmTable(items)

  const counts = {
    statsFilled: 0,
    statsDocumented: 0,
    tmFilled: 0,
    tutorFilled: 0,
    levelUpFilled: 0,
    sinnohanTypesFilled: 0,
    sinnohanStatsFilled: 0,
    /** Sinnohan entries that gained the `type` change kind from their form's typing. */
    sinnohanTypeKindsAdded: 0,
    baselineMissing: 0,
    tmNoSlot: 0,
    slotNameMismatch: 0,
    docTmEntries: 0,
    docTutorEntries: 0,
    compatNotesOnly: 0,
    moveNameFallbacks: 0,
    baseTypesFilled: 0,
    baseTypesMissing: 0,
    formTypesFromDocument: 0,
    formsSynthesized: 0,
    formChangeNotes: 0,
  }

  const fallbackNames = new Set()

  /* ---- Pokémon Changes ------------------------------------------- */
  for (const entry of pokemon) {
    const base = baseline.at(entry.dex)
    if (!base) {
      counts.baselineMissing++
      log?.warn(`no vanilla Platinum baseline for dex ${entry.dex} (${entry.name}) — left as documented`)
    }

    /*
     * 1. baseTypes (rev 3). The documents record only *changes*, so 424 of the
     * 493 entries would otherwise have no type at all — every legendary among
     * them. The vanilla Gen-IV typing is always present, so the UI can show
     * "Arceus — Normal" or "Charizard — Fire / Flying" instead of nothing.
     * For a Sinnohan entry this is the typing of the species it replaces, which
     * is exactly `SinnohanForm.replacedTypes` for the same dex.
     */
    if (base && base.types.length > 0) {
      entry.baseTypes = [...base.types]
      entry.baseTypesSource = 'baseline'
      counts.baseTypesFilled++
    } else {
      counts.baseTypesMissing++
    }

    // 2. baseStats — documented `New` wins, baseline otherwise.
    if (entry.stats?.new) {
      entry.baseStats = clone(entry.stats.new)
      entry.baseStatsSource = 'documented'
      counts.statsDocumented++
    } else if (base) {
      entry.baseStats = clone(base.stats)
      entry.baseStatsSource = 'baseline'
      counts.statsFilled++
    }

    // 3. alternate-form typings (rev 3).
    const baseForms = baseline.formsAt(entry.dex)
    attachFormTypes(entry, baseForms, counts, log)
    if (baseForms.length > 0) {
      /*
       * Problem 4: how a form is *changed* is not documented anywhere in the
       * corpus. Rather than leaving the UI to guess, the entry says so.
       */
      entry.sections.push({
        title: FORM_CHANGE_SECTION_TITLE,
        lines: [...FORM_CHANGE_SECTION_LINES],
      })
      counts.formChangeNotes++
    }

    // 4. learnset — baseline first, then the compatibilities the docs add.
    const note = String(entry.dex).padStart(3, '0')
    const compat = parseCompatNotes(entry.moves)
    counts.docTmEntries += compat.tms.length
    counts.docTutorEntries += compat.tutors.length
    counts.compatNotesOnly += compat.notesOnly.length

    const { filled, stats } = fillLearnset(entry.learnset, base, compat, {
      baseline,
      spell,
      hackTmTable,
      log,
      who: `${note} - ${entry.name}`,
    })
    if (filled.tm > 0) counts.tmFilled++
    if (filled.tutor > 0) counts.tutorFilled++
    if (filled.levelUp > 0) counts.levelUpFilled++
    counts.tmNoSlot += stats.tmNoSlot
    counts.slotNameMismatch += stats.slotNameMismatch

    if (filled.tm > 0 || filled.tutor > 0 || filled.levelUp > 0) entry.learnset.includesBaseline = true
  }

  /* ---- Sinnohan forms -------------------------------------------- */
  for (const form of sinnohan) {
    const base = baseline.at(form.dex)
    if (!base) {
      counts.baselineMissing++
      log?.warn(`no vanilla Platinum baseline for dex ${form.dex} (${form.name})`)
      continue
    }

    // The vanilla species this regional form replaces.
    if (base.types.length > 0) {
      form.replacedTypes = [...base.types]
      counts.sinnohanTypesFilled++
    }
    form.replacedStats = clone(base.stats)
    counts.sinnohanStatsFilled++

    /*
     * Sinnohan entries document *complete* TM and tutor lists, so the baseline
     * is only used when the entry leaves the list out entirely (4 TM lists and
     * 1 tutor list in the corpus).
     */
    const { filled } = fillLearnset(form.learnset, base, { tms: [], tutors: [] }, {
      baseline,
      spell,
      hackTmTable,
      log,
      who: `${String(form.dex).padStart(3, '0')} - ${form.name}`,
      documentsOwn: true,
    })
    if (filled.tm > 0) counts.tmFilled++
    if (filled.tutor > 0) counts.tutorFilled++
    if (filled.tm > 0 || filled.tutor > 0) form.learnset.includesBaseline = true
  }

  /*
   * ---- Sinnohan entries must carry the change kinds their form documents ----
   *
   * `pokemon.json` lists the *replaced* species and the parser only sees
   * `PokemonChanges.txt`, which says nothing about a Sinnohan form — so all 65
   * entries came out as `changeKinds: ['form']`.
   *
   * That made the UI contradict itself: `PokemonCard` renders a "Type change"
   * tag for any Sinnohan form whose typing differs from the species it
   * replaces, but the "Type" facet chip on `#/pokemon` filters on
   * `changeKinds`, so those very cards were excluded from the filter that
   * claims to list them. (Sinnohan Ambipom: the card reads `Normal → Normal /
   * Fighting`, yet filtering by "Type" hid it.)
   *
   * The type really did change, so the kind belongs on the entry. Only `type`
   * is added: it is the one kind these cards tag. Stats, abilities and
   * learnsets are presented through the form's own card instead.
   */
  const sinnohanByDex = new Map(sinnohan.map((form) => [form.dex, form]))
  for (const entry of pokemon) {
    if (!entry.isSinnohan || entry.changeKinds.includes('type')) continue
    const form = sinnohanByDex.get(entry.dex)
    const before = form?.replacedTypes ?? entry.baseTypes ?? []
    const after = form?.types ?? []
    if (after.length === 0) continue
    const changed = after.length !== before.length || after.some((type) => !before.includes(type))
    if (!changed) continue
    entry.changeKinds.push('type')
    counts.sinnohanTypeKindsAdded++
  }

  for (const slug of baseline.unresolvedMoveNames) {
    if (fallbackNames.size < 20) fallbackNames.add(slug)
    counts.moveNameFallbacks++
  }
  if (counts.moveNameFallbacks > 0) {
    log?.warn(
      `${counts.moveNameFallbacks} baseline move slug(s) have no English name in the cache ` +
        `(first: ${[...fallbackNames].join(', ')}) — a title-cased slug is used instead`,
    )
  }

  return counts
}
