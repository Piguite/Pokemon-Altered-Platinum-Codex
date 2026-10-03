# Data Contract — Altered Platinum Codex

> **FROZEN.** `src/types/data.ts` is the single source of truth for every shape below.
> The pipeline produces it, the UI consumes it. Neither side may invent fields.

## Source material

The three Scribd PDFs the user linked are the *same* documents that ship inside the
hack's own release archive. The original plain-text files were recovered from the
release ZIP on the hack author's Google Drive and are stored verbatim in
`data/source/`:

| File | Linked Scribd doc | Contents |
| --- | --- | --- |
| `PokemonChanges.txt` | *Pokemon Changes* | 497 per-Pokémon entries: type/stat/ability changes, learnsets, form variants |
| `TypeChanges.txt` | *TypeChanges* | Ice type-chart rework + 69 Pokémon type changes with justifications |
| `SinnohanForms.txt` | *Sin-No-Han-Forms* | 65 Sinnohan form entries: types, abilities, stats, learnsets |
| `EvolutionChanges.txt` | — | Item-interaction, level and method evolution changes |
| `MoveChanges.txt` | — | Move replacements, 10 new moves, numeric modifications |
| `ItemChanges.txt` | — | Modified items, prices, TM/mart stock, item & TM locations |
| `TrainerPokemon.txt` | — | Trainer rosters by area + detailed boss sets |
| `WildPokemon.txt` | — | Wild encounters by area, method and time of day |
| `SpecialEvents.txt` | — | Gift, static and in-game trade events |
| `NPCChanges.txt`, `TradeChanges.txt`, `LevelCaps.txt`, `FrequentlyAskedQuestions.txt`, `ActionReplayCodes.txt` | — | Miscellaneous changes |
| `Changelog.txt` | — | Version history (recovered from the release ZIP root) |

`data/source/typechart_new.png` is the author's original type-chart image and can be
shown as a reference in the Types view.

## Output files — `public/data/`

All files are UTF-8 JSON. Every file must exist even when its collection is empty.

| File | TypeScript type |
| --- | --- |
| `meta.json` | `MetaDoc` |
| `pokemon.json` | `PokemonChange[]` |
| `sinnohan.json` | `SinnohanForm[]` |
| `type-changes.json` | `TypeChangesDoc` |
| `moves.json` | `MovesDoc` |
| `items.json` | `ItemsDoc` |
| `evolutions.json` | `EvolutionsDoc` |
| `trainers.json` | `TrainersDoc` |
| `wild.json` | `WildDoc` |
| `events.json` | `EventsDoc` |
| `misc.json` | `MiscDoc` |
| `changelog.json` | `ChangelogEntry[]` |
| `search-index.json` | `SearchRecord[]` |

## Parsing rules

The sources are hand-written, tab/space-mixed, fixed-width-ish text. The parser must be
tolerant and **must never silently drop content**.

1. **Normalise whitespace first.** **Every source file uses CRLF** — strip `\r` before
   anything else or every `^…$` anchor silently fails. Then `\t` → spaces, and collapse
   runs of spaces while keeping column separation for fixed-width tables.
   Field labels vary: `Base Stats :`, `Base Stats:`, `Type :`, `Ability :` all occur.
   Match a label as `^Label\s*:\s*$` case-sensitively.
2. **Entry headers** in `PokemonChanges.txt` / `SinnohanForms.txt` are
   `NNN - Name` directly under a `===================` rule, closed by another rule.
3. **`Old`/`New` pairs** inside `Base Stats`, `Type`, `Ability`, `Base Happiness`,
   `Held Item`, `Gender Ratio` sections are prefixed `Old` / `New` after normalisation.
4. **Stat blocks** look like
   `78 HP / 84 Atk / 78 Def / 109 SAtk / 85 SDef / 100 Spd / 534 BST`
   Parse all seven numbers. `BST` is authoritative from the source but must also be
   cross-checked against the six stats; report mismatches in the build log.
5. **Type lists** are `Fire / Flying` → `["Fire","Flying"]`. Preserve `???` if present.
6. **Ability lists** are `Chlorophyll / Overgrow` → `["Chlorophyll","Overgrow"]`.
7. **Learnsets**: level-up lines are `LEVEL - Move`, optionally suffixed `(!!)` and/or
   `(PLA)`. TM lines are `NN Toxic` or `HM01 Cut`. Tutor lines are bare move names.
   Form-scoped variants appear as `Level Up (Sky Forme):`, `Base Stats (Plant Cloak) :`,
   `Moves (Trash Cloak):` — route these into `forms[]`, not the main learnset, unless the
   scope names the species itself (the exception documented below).
   A level-up line may also carry a replacement arrow: `1 - Bug Bite >> Amnesia (!!)`
   means the slot now teaches `Amnesia` instead of `Bug Bite` → set
   `LearnEntry.move = "Amnesia"` and `LearnEntry.replaces = "Bug Bite"`.
   There are exactly **19** such lines, all inside Wormadam's Plant/Sandy/Trash Cloak
   learnsets (source lines 11517–11575); after the rev-4 promotion **6** of them are in
   Wormadam's own `learnset.levelUp` (the Plant Cloak list) and **13** stay on the two
   alternate-cloak variants, so the corpus total is unchanged. Beware substring traps when
   splitting (e.g. `Bubble` vs `Bubble Beam`): split on ` - ` / ` >> `, never on bare names.

   Form-scoped labels found in the source, for reference — route them into
   `forms[]` with the form name from the parentheses:
   `Base Stats(All Evolutions)`, `Level Up (Normal|Attack|Defense|Speed Forme)` (Deoxys),
   `Base Stats|Level Up|Moves (Plant|Sandy|Trash Cloak)` + `Moves (Trash Cloak)` (Wormadam),
   `Ability (Fan Rotom)`, `Level Up (Land|Sky Forme)` (Shaymin).
   Note `Base Stats(All Evolutions):` has **no space** before the parenthesis.
   **Exception (rev 3, widened in rev 4):** a scope that names the species itself rather
   than one of its forms fills the *entry's own* `stats` / `ability` / `levelUp` / `moves`,
   and no variant is emitted. Two disjoint cases qualify, checked in this order:
   1. **the scope is the species' own default form** — `Plant Cloak` on Wormadam
      (Wormadam *is* its Plant Cloak: that is the cloak Burmy has when it evolves in
      grass), `Normal Forme` on Deoxys, `Land Forme` on Shaymin. Which form is the default
      is a *baseline* fact (`isDefault` in PokeAPI's `pokemon-form` data), never stated by
      the documents, so `scripts/build-data.mjs` injects it into the parser as
      `isDefaultFormScope`. It wins **even inside a parallel per-form set**: the sibling
      scopes are the alternates, this one is the species. Without it Wormadam's page had
      no stats, no ability and no documented learnset — all three sat in a pseudo-form
      named `Plant Cloak`, listed as an "alternate form".
   2. **the scope is a generic alias** for the species — `Regular Form` on Rotom, which is
      not a form name of any kind. Trusted only when the entry declares a single scope for
      that label: with two or more, the block is a deliberate per-form breakdown.
   `All Evolutions` on Eevee never promotes: it names a group of *other* Pokémon, so it
   stays a variant. Every promotion is reported by each build
   (`rev 4 — form-scoped sections read as species-level`), nothing is dropped — the
   promoted section's text stays verbatim in `sections[]` — and the rule is audited
   row-by-row in `docs/PARSE-REPORT.md` §10.2.
8. **Sinnohan entries**: the header is `NNN - Sinnohan Foo`, except dex 309/310 which
   the source leaves un-prefixed (`Electrike`, `Manectric`) even though they are
   Sinnohan — normalise the `Sinnohan ` prefix in and set `baseName` from the species.
   `Stats:` on Sinnohan entries is a *single* block (there is no Old/New pair).
9. **`TypeChanges.txt` table rows** are four columns separated by two-or-more spaces:
   `#006 Charizard   Fire / Flying   Fire / Dragon   Justification`.
   Rows using tabs instead must parse identically.
10. **`Ice now takes 0.5x from Ground.`** → `{ attacker: "Ground", defender: "Ice",
    oldMultiplier: 1, newMultiplier: 0.5 }`. The vanilla value is the standard Gen-IV
    type-chart value. The four sentences and their **exact** result:

    | Sentence | attacker | defender | old | new |
    | --- | --- | --- | --- | --- |
    | `Ice now takes 0.5x from Ground.` | Ground | Ice | 1 | 0.5 |
    | `Ice now takes 1x from Rock.` | Rock | Ice | 2 | **1** |
    | `Ice now takes 0.5x from Water.` | Water | Ice | 1 | 0.5 |
    | `Ice now takes 0.5x from Dragon.` | Dragon | Ice | 1 | 0.5 |

    Note the Rock row: Rock's **2× weakness is removed to 1×**, it does *not* become a
    resistance. Read the multiplier from the sentence rather than assuming 0.5.
    Follow each sentence with its trailing free-text rationale paragraph (`Rock: …`) into
    `rationales[]`.
11. **Bullet lists** start with `- `. Keep the leading `- ` stripped in `lines[]`.
12. **`>>` arrows** denote a change: `Power: 75 >> 90`, `$200 >> $50`,
    `Flinch (30%) >> Flinch (5%)`. Split into `{ label, from, to }` / `oldPrice`/`newPrice`.
13. **Trainer lines** are `Name [markers]   Mon Lv. N, Mon Lv. N`. Markers to capture:
    `*`, `!`, and parenthesised `(3) (5) (8) (C) (S)`. Species suffixed `(S)` are
    Sinnohan → `isSinnohan: true` and strip the suffix from `species`.
    Lines under a `Rematches` heading go to `rematches[]`.
    Detailed boss blocks are a bare trainer name followed by lines shaped
    `Species (Lv. N) @ Item   /   Ability   /   Move, Move, Move, Move`.
14. **Wild lines** are `Method<2+ spaces>Species (NN%), Species (NN%)`. `(S)` suffix →
    Sinnohan. `Levels:` lines belong to the area.
15. **Anything unparsed must be preserved** in the nearest `RawSection` / `noteSections`
    so the UI can still show it. The build must print a report of unparsed lines and the
    report must be reviewed before the UI is considered correct.

## Query counts the build must assert

The build script `scripts/build-data.mjs` must verify these and exit non-zero on failure:

- `pokemon.length === 493`
  — **not 497.** The document contains exactly 493 entries, one per dex number 1–493.
  A naive `grep -cE '^[0-9]{3} - '` reports 497 because Arceus's learnset ends with four
  *level-100* moves (`100 - Recover`, `100 - Judgment`, `100 - Spacial Rend`,
  `100 - Shadow Force`) that are shaped exactly like an entry header. Anchor entry
  headers to the surrounding `===================` rules, never to the line shape alone.
- `sinnohan.length === 65`
- `typeChanges.pokemonChanges.length === 69`
- `typeChanges.chartChanges.length === 4`
- `moves.replacements.length === 29`
- `moves.newMoves.length === 10`
- the number of `LearnEntry` objects with `replaces` set === **19**
- every `PokemonChange.dex` unique; every `SinnohanForm.dex` unique
- every `StatBlock` where all six stats are present satisfies `bst === hp+atk+def+spa+spd+spe`
- no `RawSection` line count drops below the number of non-blank body lines in the source

`pokemon.length` must be asserted against **493** with no exceptions or "known mismatch"
allowances. If an assertion is relaxed, that is a bug in the pipeline, not in the contract.

## Sprites

`public/sprites/<dex>.png` — 96×96 PokeAPI sprites for dex 1–493, fetched by
`scripts/fetch-sprites.mjs` (idempotent; skips files already present).
Sinnohan forms and their evolutions reuse the **original species** sprite but must always
be rendered with a visible `S` badge, because the hack's custom sprites are not
redistributable.

## Enrichment from the vanilla Platinum baseline (rev 2)

The hack's documents record **only changes**. They never enumerate a Pokémon's full
TM/HM or move-tutor list, and 264 of 493 entries have no stats at all. Three
user-visible gaps follow from that, and all three are closed by enriching from the
vanilla Platinum baseline.

**Source:** PokeAPI, filtered to the `platinum` version group —
`https://pokeapi.co/api/v2/pokemon/<dex>` gives `stats[]` and `moves[].version_group_details[]`,
where `move_learn_method.name` is `level-up`, `machine` (TM/HM) or `tutor`.
This is used instead of scraping Poképedia because it is structured, offline-cacheable
and *Platinum-specific* (Poképedia pages mix every generation's CT list together).

### Rules

1. **Documented values always win.** Never overwrite anything the hack's documents state.
2. `PokemonChange.baseStats` — set to `stats.new` when a change is documented
   (`baseStatsSource: "documented"`), otherwise filled from the baseline
   (`baseStatsSource: "baseline"`). Every entry must end up with a `baseStats`.
3. `learnset.tm` / `learnset.tutor` — start from the baseline list, then merge in the
   compatibilities the documents add, marking those `isNew: true`. Set
   `includesBaseline: true` whenever baseline entries are present.
4. **The `Moves:` compat lines must be parsed.** They are currently dropped into
   `moves[]` notes only, which is why Charizard shows a "Draco Meteor from the Move
   Tutor" note but an empty tutor list. Shapes to handle:
   - `Now compatible with TM88, Hurricane. (!!)` → TM `88`, `Hurricane`, `isNew`
   - `Now compatible with HM01, Cut. (!!)` / `HMN, Cut` → HM entry
   - `Now compatible with Draco Meteor from the Move Tutor. (!!)` → **tutor** entry
   - `Now compatible with all TMs and HMs.` → note only, no single entry
5. `SinnohanForm.replacedTypes` / `replacedStats` — the vanilla types and stats of the
   base species, so the UI can show `Dark → Dark / Steel`.
6. `meta.enrichment` records what was filled, from where, and when.

### rev 3 — types for everything, and the alternate forms

The documents record *changes* only, which left two holes that rev 3 closes with the same
baseline and the same "documented values always win" rule.

7. **`PokemonChange.baseTypes` + `baseTypesSource: "baseline"` on all 493 entries.** They hold
   the **Generation-IV** typing read from `past_types[]` (the same `genFourTypes()` helper as
   `replacedTypes`), never PokeAPI's current typing — `Togetic` is `Normal / Flying`, not
   `Fairy / Flying`; `Granbull` is `Normal`. For a Sinnohan entry they equal the replaced
   species' Gen-IV types, i.e. `sinnohan.json[dex].replacedTypes` (asserted). When `type` is
   absent the Pokémon keeps these types in Altered Platinum, so *every* entry — including the
   legendaries the documents never re-type — has a type to display.
8. **`FormVariant.types` for every accepted alternate form.** `/pokemon/<dex>` carries only the
   species' default typing, so the alternate forms' types come from the 26 cached
   `/pokemon-form/<slug>` responses (`FORM_VARIANTS` in `scripts/lib/baseline.mjs`, fetched by
   `scripts/fetch-baseline.mjs` into `form-<slug>.json`). Rotom's five appliances therefore
   resolve to `Electric / Fire|Water|Ice|Flying|Grass`, which is the hack's own Gen-V rule
   (`TypeChanges.txt`) applied per form; Deoxys, Wormadam, Shaymin, Giratina, Burmy, Castform
   and Cherrim resolve from the same source. A form the documents never mention is added under
   PokeAPI's English name (`Origin Giratina`); the species' **default** form is never added —
   it is the species, and its typing is `baseTypes`.
9. **A form scope that names the species itself is species-level.** Two cases, both filling
   the entry's own `stats` / `ability` / `levelUp` / `moves` with no variant emitted:
   `Base Stats (Regular Form)` on Rotom (a generic alias for the species, the only such
   scope in the corpus, trusted because the entry declares a single `Base Stats` scope) and
   a scope naming the species' **default form** — `Plant Cloak` (Wormadam), `Normal Forme`
   (Deoxys), `Land Forme` (Shaymin) — which the baseline's `isDefault` flag identifies and
   which stays species-level even inside a parallel per-form set. Wormadam therefore ends up
   with the Plant Cloak spread (`60/59/85/79/105/36` → `70/50/90/120/110/60`), ability and
   learnset at species level, and only `Sandy Cloak` / `Trash Cloak` as forms. `All
   Evolutions` on Eevee stays a variant because it names a group of other Pokémon. The full
   per-section audit is §10.2 of `docs/PARSE-REPORT.md`.
10. **Type cross-checks are reported, not asserted.** Every build prints (a) all 65 Sinnohan
    forms' `replacedTypes` (baseline, Gen IV) against their documented `types`, classified
    superset / subset / partial-overlap / full-retype, and (b) the 69 `TypeChanges.txt` rows'
    stated `Old` type against the baseline's Gen-IV typing. Both are review lists: Sinnohan
    forms legitimately do full retypes (33 of 65 share no type with the species they replace),
    and one row (dex 210 Granbull) states the modern Gen-VI `Fairy` typing rather than
    Platinum's `Normal`. Only the mechanical invariants are hard assertions:
    `every baseTypes is a non-empty list of valid PType`, `every TypeChanges oldTypes …`,
    `every SinnohanForm.replacedTypes …`.
11. **How to change form is not documented, and the data says so.** No document in
    `data/source/` describes Secret Key, Gracidea, appliances, the Rotom Room or any other
    form-change mechanic. The eight form-bearing entries carry a pipeline note in `sections[]`
    (`Form Change (pipeline note)`, explicitly marked *not source text*) instead of an invented
    mechanic; `SpecialEvents.txt` (→ `events.json`) remains the source for where each Pokémon is
    obtained. Findings and the open contract questions are in `docs/PARSE-REPORT.md` §9.

### Grouped move changes

`Move Group Modifications` blocks name several moves at once and may attach a
change to a subset. `Fire Blast/Thunder/Blizzard/Hydro Pump/Focus Blast/Hurricane`
with `Effect(Hurricane): Confusion (30%) >> No Effect` means Power/Accuracy/PP apply
to all six and the effect applies **only to Hurricane**. Emit it as one
`MoveModification` with `moves` (6), `changes` (3) and
`exceptions: [{ moves: ["Hurricane"], label: "Effect", from: "Confusion (30%)", to: "No Effect (Engine limitation)" }]`.
The leading prose (`Batch changes made to multiple similar moves.`) goes to
`groupNotes`, not to a modification record.

## Contract revisions

- **rev 2** — `TMLearn.isNew`, `TutorLearn` (tutor is now a list of objects, not
  strings), `Learnset.includesBaseline`, `PokemonChange.baseStats` +
  `baseStatsSource`, `SinnohanForm.replacedTypes` + `replacedStats`,
  `MoveModification.moves[]/label/exceptions[]`, `MovesDoc.groupModifications` +
  `groupNotes`, `MetaDoc.enrichment`, `ChangeKind` gains `form`.
- **rev 3** — `PokemonChange.baseTypes` + `baseTypesSource: "baseline"` (vanilla Gen-IV
  typing on all 493 entries) and `FormVariant.types` (an alternate form's own typing).
  Baseline `derived.json` `cacheVersion` 1 → 2: `pokemon[].currentTypes` and a `forms`
  projection; the fetcher now caches 26 `/pokemon-form/<slug>` responses. The pipeline
  also promotes a single default-form scope to the species-level field, adds the
  `Form Change (pipeline note)` raw section where the mechanism is undocumented, and
  prints the Sinnohan / `TypeChanges.txt` cross-check tables — see
  `docs/PARSE-REPORT.md` §9. No field was renamed or removed; both additions are
  optional in TypeScript but always present on the emitted data.

