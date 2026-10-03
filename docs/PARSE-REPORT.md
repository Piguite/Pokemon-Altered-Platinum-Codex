# Parse Report — Altered Platinum data build

Generated from the counters printed by `node scripts/build-data.mjs`.
Contract: `docs/DATA-SCHEMA.md` + `src/types/data.ts` (both frozen).
Pipeline: `scripts/build-data.mjs` (+ `scripts/lib/*.mjs`), Node 22 ESM, no dependencies, offline.

Reproduce every number in this document with:

```bash
node scripts/build-data.mjs                 # prints the full audit
node_modules/.bin/tsc --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution bundler --resolveJsonModule --skipLibCheck scripts/contract-check.ts
node scripts/fetch-sprites.mjs              # sprites (network required)
```

---

## 1. Output files

`public/data/` — counts are top-level records; byte sizes are of the emitted file.

| File | Records | Bytes | Source document(s) |
| --- | ---: | ---: | --- |
| `meta.json` | 1 | 15 932 | all 14 documents (index, prose, counts) |
| `pokemon.json` | 493 | 806 154 | `PokemonChanges.txt` |
| `sinnohan.json` | 65 | 240 320 | `SinnohanForms.txt` |
| `type-changes.json` | 1 doc | 16 508 | `TypeChanges.txt` |
| `moves.json` | 1 doc | 18 972 | `MoveChanges.txt` |
| `items.json` | 1 doc | 27 085 | `ItemChanges.txt` |
| `evolutions.json` | 1 doc | 7 641 | `EvolutionChanges.txt` |
| `trainers.json` | 1 doc | 307 290 | `TrainerPokemon.txt` (+ `LevelCaps.txt` prose) |
| `wild.json` | 1 doc | 158 299 | `WildPokemon.txt` |
| `events.json` | 1 doc | 23 738 | `SpecialEvents.txt` |
| `misc.json` | 1 doc | 9 714 | `NPCChanges.txt`, `TradeChanges.txt`, `LevelCaps.txt`, `FrequentlyAskedQuestions.txt`, `ActionReplayCodes.txt` |
| `changelog.json` | 0 | 3 | *none* — `Changelog.txt` is absent from `data/source/` (§6.11) |
| `search-index.json` | 1 433 | 633 135 | all of the above |
| **Total** | | **2 264 791** | |

Structured record counts inside the document files:

| Collection | Count |
| --- | ---: |
| Pokémon entries | 493 |
| — with a type change / stat change / ability change | 69 / 229 / 313 |
| — flagged Sinnohan | 65 |
| — form variants (Rotom, Deoxys, Shaymin, Wormadam, Eevee) | 12 |
| Sinnohan forms (1 153 level-up moves) | 65 |
| Type-chart cells changed / Pokémon type changes | 4 / 69 |
| Move replacements / new moves / move modifications | 29 / 10 / 113 |
| Items: usable 11, costs 21, TM moves 9, locations 113, TM locations 100, plates 16, replaced 13 | 283 |
| Evolution entries (3 sections) | 48 |
| Trainer areas / trainer lines / detailed boss teams | 87 / 774 / 72 |
| Wild areas / encounter methods / encounter slots | 96 / 501 / 2 469 |
| Event items (4 sections) | 49 |
| NPC sections / trades / FAQ entries | 7 / 4 / 9 |
| Search records | 1 433 |

---

## 2. Assertion results

Every row below is a hard assertion: a failure makes the build `exit(1)`.
`PASS*` = passed with a documented caveat printed beneath it.
`pokemon.length` is asserted against **493** with no allowance, as the amended
`docs/DATA-SCHEMA.md` requires.

| # | Assertion | Expected | Actual | Result |
| --- | --- | ---: | ---: | --- |
| 1 | `pokemon.length` | 493 | 493 | PASS |
| 2 | `sinnohan.length` | 65 | 65 | PASS |
| 3 | `typeChanges.pokemonChanges.length` | 69 | 69 | PASS |
| 4 | `typeChanges.chartChanges.length` | 4 | 4 | PASS |
| 5 | `moves.replacements.length` | 29 | 29 | PASS |
| 6 | `moves.newMoves.length` | 10 | 10 | PASS |
| 6b | `LearnEntry` objects with `replaces` set (incl. `forms[].levelUp`) | 19 | 19 | PASS |
| 7 | every `ChangeKind` is a valid union member | 0 invalid | 0 | PASS |
| 8 | every `SearchKind` is a valid union member | 0 invalid | 0 | PASS |
| 9 | every `route` is a known app route | 0 invalid | 0 | PASS |
| 10 | every type name is a valid `PType` | 0 invalid | 0 | PASS |
| 11 | `PokemonChange.dex` unique | unique | unique | PASS |
| 12 | `SinnohanForm.dex` unique | unique | unique | PASS |
| 13 | every `StatBlock`: `bst === hp+atk+def+spa+spd+spe` | 0 mismatches | 0 | PASS\* (25 source BSTs recomputed, §6.2) |
| 14 | no `RawSection` shorter than its source body | 0 shortfalls | 0 | PASS |

An **independent audit** (`tools/audit.mjs`, written by the orchestrator with deliberately
separate logic) passes with **`ALL HARD CHECKS PASSED` — 0 hard failures, 1 soft warning**:

```
✓ pokemon.json length == rule-anchored "NNN - Name" headers
✓ sinnohan.json length == rule-anchored "NNN - Name" headers
✓ type-changes.pokemonChanges == "#NNN" table rows in TypeChanges.txt
✓ type-changes.chartChanges == "Ice now takes" sentences
✓ moves.replacements == 29 rows between the Old Move / New Moves headers
✓ moves.newMoves == "Description:" blocks in MoveChanges.txt
✓ items.costChanges: priced rows == "($N >> $N)" lines in ItemChanges.txt
✓ items.costChanges models the "now cost zero and are thus unsellable" list as $0
! wild.areas roughly matches "Levels:" lines in WildPokemon.txt [96 vs 79]
✓ every "compatible" source line is preserved somewhere in pokemon.json
✓ learnset ">>" replacements captured (LearnEntry.replaces)
✓ no Pokemon entry / Sinnohan entry / RawSection is empty
✓ every StatBlock satisfies bst == hp+atk+def+spa+spd+spe  (and none is negative)
✓ pokemon dex + slug unique; sinnohan dex + slug unique
✓ Charizard Fire/Flying -> Fire/Dragon; Arceus BST 1000; Bayleef stat reshuffle
✓ Sinnohan Butterfree: Bug/Fairy, 535 BST, >= 20 level-up moves
✓ dex 309 normalised to a Sinnohan name; Rock 2x -> 1x on the Ice chart
✓ search index >= 1200 records, every record complete and routed
✓ every Pokémon appears in the search index
✓ meta.counts.* agree with the data
✓ meta.documents covers every source document

ALL HARD CHECKS PASSED (1 soft warning)
```

**The single soft warning is a false positive in the audit's counter, not a data problem.**
`WildPokemon.txt` labels its header line three different ways:
`Levels:` ×79, `Level:` ×14 and `Wild Levels:` ×2 = **95 labelled headers**, and the 96th area
(`Turnback Cave`, the first of its two blocks) has no level line at all. `wild.json` carries
exactly 95 non-empty `levels` strings and 96 areas, so the audit's `96 vs 79` comparison simply
counts only the `Levels:` spelling.

Additional verification run outside the script:

* `node scripts/build-data.mjs` exits **0**.
* Two consecutive runs produce **byte-identical** output (`md5sum -c` over all 13 files: OK).
* `scripts/contract-check.ts` type-checks all 13 JSON files against `src/types/data.ts`
  with `tsc --strict` (root assignability): **clean**. The only hand-narrowing is for the
  three string-literal unions (`changeKinds`, `SearchKind`, `MoveNote.source`), which JSON
  module inference widens to `string`; rows 7–10 assert those unions at runtime instead.

---

## 3. Unparsed / hand-checked lines

**Total unparsed lines: 18** (of 34 766 non-blank source lines — 0.05 %).

An "unparsed" line is one that the parser could **not** map onto a typed field. Every one of
them is still retained verbatim:

* inside the entry's `sections[]` (a `RawSection` whose `title` is the label it sits under), or
* inside the relevant `noteSections` / `generalNotes` collection.

None of them is dropped. They are hand-checked below.

| # | Source line (line no.) | File / section | Why it has no typed field |
| --- | --- | --- | --- |
| 1 | `Eeveelutions all use the same set of base stats, distributed differently.` (3833) | `PokemonChanges.txt` → `133 - Eevee` → `Base Stats(All Evolutions)` | Prose inside a stat section. `FormVariant` has `stats` but no free-text field. Kept as a section line. |
| 2 | `These have been slightly boosted.` (3834) | same | same |
| 3 | `Catch Rate` (5608) | `201 - Unown` → `Base Stats` | "Catch Rate" is a *sub*-label the source writes without a colon. `PokemonChange` has no catch-rate field; the value below it is not a stat block. |
| 4 | `Old 225` (5609) | same | Catch-rate value (`old`), not a stat block |
| 5 | `New 255` (5610) | same | Catch-rate value (`new`), not a stat block |
| 6 | `Catch Rate` (10358) ×3 | `374/375/376 - Beldum/Metang/Metagross` → `Ability` | same sub-label, sitting inside an ability section |
| 7 | `Old 3` / `New 45` (10358-10359) ×3 | same | catch-rate values |
| 8 | `Now compatible with TM47, Iron Head. (!!)` (2414) | `232 - Donphan` → `Base Stats` | A `Moves:` style note that the source misplaced inside the stat block. Both halves are preserved; the note is also visible in that entry's `sections[]`. |
| 9 | `1 - Headlong Rush (1)` (5919) | `214 - Heracross` → `Level Up` | The source uses a stray `(1)` marker where `(!!)`/`(PLA)` is expected. The move and level parse correctly (`Headlong Rush`, level 1); only the unknown marker is reported. |
| 10 | `Design based on a sketch provided by TheOnlineNinja759!` (3361) | `SinnohanForms.txt` → `047 - Sinnohan Parasect` | Design credit with no field on `SinnohanForm`. Kept as the first line of that entry's `sections[]`. |

### Content deliberately *relocated* rather than reported as unparsed

These lines have no field on their own type, but they do fit a typed field elsewhere, so they
are moved instead of being counted above:

| Source | Home in the JSON | Why |
| --- | --- | --- |
| `TrainerPokemon.txt` — `With Rock Climb` (Route 216), `Note: In the first round, …` / `Round 1` / `Round 2` (Pokémon League), `[Battle Marathon Only]` (Battleground) | `TrainersDoc.generalNotes` as `"<Area>: <text>"`, and `meta.json` `documents[trainer-pokemon].generalNotes` as structured `NoteSection`s | `TrainerArea` only has `area`/`trainers`/`rematches`/`bosses`; the area prefix keeps the context that the type cannot hold |
| `ItemChanges.txt` — `* A means the location has changed…`, the plate-location prose, table headers | `ItemsDoc.noteSections` (`TM Locations`, `Plate Locations`) | Table preamble; `ItemsDoc` has a `noteSections` collection for exactly this |
| `MoveChanges.txt` — the two replacement-table sentences | `MovesDoc.noteSections` (`Move Replacements`) | same |
| `NPCChanges.txt` — `Location: Snowpoint City` | first entry of the section's `lines[]` | `NoteSection` has no location field |
| `EvolutionChanges.txt` — `"Using" in this context means …` | `EvolutionSection.lines[]` | prose member of a section that also carries `entries[]` |
| `FAQ` — bullets that follow a `---` sub-section | `faq[].answer[]` | a question has only `answer` + `subsections`; interleaving cannot be represented, so bullets stay with the question and sub-section bullets stay in their sub-section |
| `SinnohanForms.txt` / `PokemonChanges.txt` — `Sinnohan Form.` / `See SinnohanForms.txt for details.` | `PokemonChange.isSinnohan = true`, `changeKinds: ["other"]` | content is expressed as a flag |
| The 5-line ASCII banner at the top of 13 of the 14 documents (`o----o`, `\| Pokémon Altered Platinum \|`, `\| Type Changes (r1.0.5) \|`, `\| Original hack by Drayano \|`) | `MetaDoc.hack`, `MetaDoc.version`, `MetaDoc.originalAuthor`, `DocumentStat.title` + `DocumentStat.version` | every word of the banner is a field already; keeping the decorative frame would only clutter the UI. `SinnohanForms.txt` has no author line and `LevelCaps.txt` has no banner at all (hence its missing `DocumentStat.version`) |

---

## 4. Known source quirks

### 4.1 Contract-level issues

1. **`pokemon.length` is 493** (settled by the contract amendment). `PokemonChanges.txt` contains
   493 entries (`rule / NNN - Name / rule`, dex 1→493, no gaps, no duplicates; the file holds
   exactly 986 nineteen-character rules = 493 × 2). The earlier "497" figure is what a naive
   `^\d{3} - ` line scan returns, because Arceus's four level-100 moves — `100 - Recover`,
   `100 - Judgment`, `100 - Spacial Rend`, `100 - Shadow Force` (lines 14040-14043, the file even
   ends without a trailing newline) — look exactly like entry headers. Entry headers are anchored
   to the surrounding rules, never to the line shape alone, and the assertion is now a plain
   hard `493` with no allowance.
2. **25 stat blocks have a BST that disagrees with their own six stats.** `docs/DATA-SCHEMA.md`
   §4 calls the source BST authoritative *and* the assertion list requires
   `bst === hp+atk+def+spa+spd+spe`. Both cannot hold. The build recomputes `bst` from the six
   stats (the values the game actually uses), warns with **both** numbers for every case, and
   leaves the original line untouched in `sections[]`. Full list in §5.
3. **Level-up replacement arrows** (`1 - Bug Bite >> Amnesia (!!)`) are settled: `LearnEntry.move`
   holds the **new** move and the new optional `LearnEntry.replaces` holds the replaced one.
   All **19** occurrences live in Wormadam's three cloak learnsets (source lines 11517–11575),
   and the build asserts the count (§2, row 6b). Learnset lines are split on the literal
   ` - ` and ` >> ` separators only — never on bare move names, so `Bubble Beam` cannot be
   damaged by a `Bubble` rule.

### 4.2 Source quirks (the four the requester spotted, plus what else turned up)

Confirmed as reported:

* **CRLF everywhere.** All 14 files use CRLF (`LevelCaps.txt` has a `\r` on every line too, but
  its final line has no terminator at all). Every `^…$` anchor fails without stripping `\r` first
  — `file` even mis-detects `LevelCaps.txt` as "CSV text" because of the stray `\r`.
* **Label spacing/punctuation is inconsistent.** `Base Stats :` vs `Base Stats:`, `Type :` vs
  `Type:`, `Ability :`, `Stats: ` (trailing space), and additionally `Ability;` (Torkoal,
  Deoxys), and a bare `Ability` with no punctuation at all (Torkoal).
* **`SinnohanForms.txt` dex 309/310** (`Electrike`, `Manectric`) omit the `Sinnohan ` prefix.
  The build normalises the prefix in and derives `baseName` from the species.
* **Mars level disagreement**, see §4.3.
* **Move-replacement rows** are tab-separated in some lines and space-separated in others
  (and tabs appear in the same file's `ItemChanges.txt` equivalents). All table parsing widens
  tabs to 4 spaces and splits on runs of 2+ spaces.
* **No trailing newline near Arceus** — line 14043 is the last line of the file.

Newly found:

* **Repeated `Old` prefix instead of `New`** in `Base Stats` for **Volbeat (313), Illumise (314),
  Sharpedo (319), Wailord (321), Camerupt (323), Grumpig (326)**: the second line is the *new*
  block but says `Old`. The build reads the second line as `New` and warns; both lines stay in
  `sections[]`.
* **`Vanilla` used instead of `Old`** in Gulpin (316) — and *only* there.
* **`New(Plant Cloak)  Chlorophyll / Unaware`** — Wormadam (413) puts the form scope inside the
  Old/New prefix rather than in the section label, and has both `Base Stats (Cloak)` sections
  *and* scoped `New` lines.
* **`Base Stats(All Evolutions):`** (Eevee, 133) — scope glued to the label with no space, and
  the stat line uses a comma layout (`130, 110, 95, 65, 65, 60 - 525 BST`) instead of
  `78 HP / 84 Atk / … / 534 BST`.
* **Level-up arrows.** Wormadam's cloak learnsets use `1 - Leaf Storm >> Heat Wave (!!)`, i.e. a
  move *replacement* inside a learnset line: `move` = `Heat Wave`, `replaces` = `Leaf Storm`,
  `isNew` = true. 19 such lines, in 10 distinct old→new pairs (Hidden Power is re-pointed three
  different ways across the three cloaks).
* **Unknown marker `(1)`** on Heracross's `1 - Headlong Rush (1)` (see §3, row 9), and markers
  glued to the name without a space (`7 - Roughhouse(!!)`).
* **`Catch Rate` sub-blocks** with no field in the contract (Unown, Beldum, Metang, Metagross).
* **Missing comma inside an encounter list**: `Fish Lure  Bibarel (60%), Crawdaunt (30%) Dragonite(S) (10%)`.
* **Two methods on one line with no separator at all**:
  `Night  … Spinarak(S) (10%)Poké Radar  Gloom (22%)` (`Route 204 ~ South`). The build splits it.
* **Wild-area headers use three different level labels** (`Levels:`, `Wild Levels:`, `Level:`)
  and one area (`Turnback Cave`) has no level line at all.
* **`Poké Radar  -`** (`Route 224`) — an explicit "nothing here" placeholder, emitted as a method
  with zero slots.
* **Duplicate area names** are genuine: `Turnback Cave` appears twice in `WildPokemon.txt` (once
  without a level line) and `Surf` appears twice for `Lake Verity`. Source order is preserved
  and the search index disambiguates with a positional suffix.
* **Trainer name/team separator is usually 2+ spaces but not always** — the
  `Interviewers Roxy & Oli (N) Magneton Lv. 30, Kirlia Lv. 30` rematches use a single space;
  the parser falls back to the first `Species Lv. N` token.
* **Boss blocks named by a trainer line.** `Arcade Star Dahlia` is simultaneously a normal
  trainer line and the name of the detailed team that follows it; the same happens for the
  Barry/Cynthia rematch sets.
* **Typo'd ability names are preserved verbatim** (`Technican`, `Intimdate`) rather than
  corrected, so the site shows what the document says.
* **`ItemChanges.txt` uses a short `==================` rule** for the `Replaced Items` section
  while every other section uses 57 `=`.
* **`SinnohanForms.txt` claims "There are a total of 30 Sinnohan Forms"** in its General Notes
  while listing 65 entries (30 form *lines*, e.g. Caterpie → Metapod → Butterfree). The claim is
  kept verbatim; the real count is the asserted 65.
* **`ItemChanges.txt` `TM Locations` header row is `TM   Location   Obtained`** (no "Move"
  column even though the move name is inside the first column), and rows mark a changed location
  with a trailing `*` in a fourth, unlabelled column.
* **`SpecialEvents.txt` uses `--` (two dashes)** instead of `---` under `#442 Spiritomb`.

### 4.3 Unreconciled disagreement between two documents (as instructed)

`LevelCaps.txt` line 2 says `Mars, Lv. 18`. `TrainerPokemon.txt` gives Commander Mars rosters at
levels 17, 18, 19 (Route 202 area set), then 52/53/57/58/77/78 (repeat encounters) and
81/82 (Battle Marathon). `LevelCaps.txt` is the outlier for the first appearance *if* `LevelCaps`
means the same fight as the level-17/18 set. **Nothing is reconciled:** the level-cap line is
emitted verbatim in `misc.levelCaps` and `trainers.levelCaps`, every Commander Mars roster keeps
its own levels, and the build prints a NOTE describing the disagreement.

### 4.4 Form-scoped sections

Every form-scoped label listed in `docs/DATA-SCHEMA.md` §7 is routed into `forms[]`, with the
form name taken from the parentheses:

| Entry | Form-scoped labels found | `forms[]` produced |
| --- | --- | --- |
| `133 - Eevee` (3832) | `Base Stats(All Evolutions):` — **no space** before the parenthesis | `All Evolutions` |
| `386 - Deoxys` (10655-10705) | `Level Up (Normal/Attack/Defense/Speed Forme):` | `Normal Forme`, `Attack Forme`, `Defense Forme`, `Speed Forme` |
| `413 - Wormadam` (11501-11575) | `Ability` + `New(Cloak)` lines, `Base Stats (…Cloak) :`, `Level Up (…Cloak):`, `Moves (Trash Cloak):` | `Plant Cloak`, `Sandy Cloak`, `Trash Cloak` |
| `479 - Rotom` (13659-13663) | `Ability (Fan Rotom) :`, `Base Stats (Regular Form) :` | `Fan Rotom`, `Regular Form` |
| `492 - Shaymin` (13979-13995) | `Level Up (Land Forme):`, `Level Up (Sky Forme):` | `Land Forme`, `Sky Forme` |

Rotom's `Type` section is prose ("All of Rotom's formes match their types as of Gen V.") — the
Gen-V form types are therefore not machine-readable and the line is preserved verbatim in
`sections[]` (see §3).

---

## 5. Source BST values that disagree with their six stats (25)

All were recomputed (see §4.1) and each is printed as a build warning. The original text remains
in `sections[]`.

| Entry | Block | Source BST | Six stats | Correct total |
| --- | --- | ---: | --- | ---: |
| Vileplume | new | 540 | 95+50+85+120+120+50 | 520 |
| Dugtrio | old | 450 | 35+100+50+50+70+120 | 425 |
| Dugtrio | new | 500 | 55+110+70+45+70+120 | 470 |
| Bellsprout | old | 295 | 50+75+35+70+30+40 | 300 |
| Weepinbell | new | 420 | 65+90+65+85+75+30 | 410 |
| Exeggutor | old | 520 | 95+95+85+125+75+55 | 530 |
| Tauros | new | 540 | 100+115+95+40+70+110 | 530 |
| Chikorita | new | 405 | 55+29+65+59+65+45 | 318 |
| Corsola | new | 525 | 75+45+150+90+150+35 | 545 |
| Skarmory | new | 505 | 65+90+140+40+90+70 | 495 |
| Shedinja | new | 366 | 1+125+5+125+5+85 | 346 |
| Shuppet | old | 305 | 44+75+35+63+33+45 | 295 |
| Chatot | new | 505 | 75+50+55+120+65+130 | 495 |
| Abomasnow | old | 494 | 90+92+75+92+85+50 | 484 |
| Tangrowth | new | 545 | 100+100+125+110+80+40 | 555 |
| Sinnohan Sandshrew | — | 330 | 50+85+110+15+30+50 | 340 |
| Sinnohan Rapidash | — | 530 | 90+50+75+120+95+110 | 540 |
| Sinnohan Dratini | — | 300 | 50+50+40+65+45+55 | 305 |
| Sinnohan Togetic | — | 420 | 55+85+110+40+75+40 | 405 |
| Sinnohan Ampharos | — | 510 | 100+45+80+115+110+50 | 500 |
| Sinnohan Forretress | — | 515 | 85+40+65+140+75+105 | 510 |
| Sinnohan Aron | — | 370 | 50+80+70+65+50+50 | 365 |
| Sinnohan Aggron | — | 545 | 70+110+115+80+75+70 | 520 |
| Sinnohan Lunatone | — | 520 | 90+60+125+95+85+55 | 510 |
| Sinnohan Solrock | — | 520 | 90+60+55+125+85+95 | 510 |

---

## 6. Confidence per document

Legend — **structural**: every line maps to a typed field and round-trips; **best-effort**: a
slice of the content is carried as prose because the frozen types have no field for it.

| Document | Fields | Confidence | Notes |
| --- | --- | --- | --- |
| `PokemonChanges.txt` | `dex`, `name`, `slug`, `isSinnohan`, `changeKinds`, `type`, `stats`, `ability`, `moves`, `learnset` (incl. `replaces`), `evolution`, `heldItem`, `baseHappiness`, `genderRatio`, `forms`, `sections` | **High** — 493/493 entries, 17 lines unparsed (0.12 % of the file) | Type (69), stats (229), ability (313), learnset and moves parse structurally. All 19 replacement arrows round-trip. 5 entries need the `Old`→`New` typo repair; 25 BSTs recomputed; `Catch Rate` blocks and two design prose lines are prose-only. Learnset order is source order. |
| `SinnohanForms.txt` | `dex`, `name`, `baseName`, `slug`, `types`, `abilities`, `stats`, `evolution`, `learnset`, `sections` | **High** — 65/65 entries, 1 line unparsed | `Type`/`Ability` are single-line values (no Old/New), `Stats` is a single block. TM (42 per average) and Tutor lists parse structurally. |
| `TypeChanges.txt` | `generalNotes`, `iceTypeNotes`, `chartChanges`, `pokemonChanges`, `rationales` | **High** — 69/69 table rows (tabs and spaces), 4/4 chart cells | The vanilla multiplier for the four cells is a small hard-coded table (Ground→Ice 1, Rock→Ice 2, Water→Ice 1, Dragon→Ice 1) exactly as `docs/DATA-SCHEMA.md` §10 prescribes. Justification text is free text and is re-joined when the source used 2+ spaces inside it. |
| `MoveChanges.txt` | `generalNotes`, `replacements`, `newMoves`, `modifications`, `noteSections` | **High** — 29/29 replacements, 10/10 new moves, 113 modifications | Two modification lines state only the *new* behaviour (`Effect: Lower own Defense and Special Defense`) — `from` is `""` rather than an invented value. Batch headings (`Agility/Nasty Plot/…`) are expanded to one entry per move. `Effect(Hurricane)`-style qualifiers are kept verbatim in `label`. |
| `ItemChanges.txt` | `generalNotes`, `usableItems`, `costChanges`, `tmChanges`, `martChanges`, `deptStoreStock`, `itemLocations`, `tmLocations`, `vitaminReplacements`, `plateLocations`, `replacedItems`, `noteSections` | **High** | 113 item locations, 100 TM locations, 16 plates, 13 replaced items, 21 cost rows. `- All TMs` has no arrow, so it is a `CostChange` with `raw` and null prices. `costChanges[].raw` always keeps the source syntax. TM changes keep the replaced move only in the note section (the type has one field). |
| `EvolutionChanges.txt` | `sections[].entries[]` | **High** — 48/48 bullets | Each bullet is split into `pokemon` + full text; non-bullet prose stays in `lines[]`. |
| `TrainerPokemon.txt` | `generalNotes`, `levelCaps`, `areas[]` | **High for rosters, best-effort for structure** — 87 areas, 774 trainer lines, 72 boss teams, 447 roster slots, 0 unparsed roster lines | Every roster line parses (species, level, `(S)`, markers, items, abilities, moves). Area-level prose and the `Round 1/2` headings are relocated to `generalNotes` with an area prefix because `TrainerArea` has no note field. The badge-count markers `(3)/(5)/(8)/(C)/(S)` are captured but their *meaning* (when the team unlocks) is only in `generalNotes`. |
| `WildPokemon.txt` | `generalNotes`, `areas[]` | **High** — 96 areas, 501 methods, 2 469 slots | Level strings are free text and are kept verbatim. Duplicate methods (`Surf` twice in Lake Verity) and duplicate area names are preserved in source order; `Poké Radar -` is an empty method. |
| `SpecialEvents.txt` | `generalNotes`, `sections[].items[]` | **High** — 49/49 events | `Location:` / `Level:` become fields; bullets stay in `lines[]`. `Level: N/A` is kept as the string `N/A`. |
| `NPCChanges.txt` | `npc[]` | **High** — 7/7 sections | `Location:` has no field, so it is the first entry of `lines[]`. |
| `TradeChanges.txt` | `trades[]`, `tradeNotes` | **High** — 4/4 trades | `givenName`/`species` come from `Gaeia the Spheal`; request, item, IVs and nature are parsed. |
| `LevelCaps.txt` | (→ `misc.levelCaps`, `trainers.levelCaps`) | **High** — 21/21 bullets | Contains the Mars disagreement (§4.3); no version banner, so `DocumentStat.version` is omitted. |
| `FrequentlyAskedQuestions.txt` | `faq[]` | **High** — 9/9 questions | Sub-sections (`Export / Import Battery Saves`, `The Filename Switch Method`) are nested correctly. Bullets that appear *after* a sub-section cannot be interleaved back into the question (the type has no slot for it) and land in `answer[]` — order within `answer[]` is preserved. |
| `ActionReplayCodes.txt` | `actionReplay[]` | **High** — 3/3 sections | Code lines are opaque hex and stay verbatim in `lines[]`. |
| `Changelog.txt` | — | **n/a** | **Not present in `data/source/`** even though `docs/DATA-SCHEMA.md` lists it. `changelog.json` is emitted as `[]` (the contract requires the file to exist even when empty) and no `DocumentStat` is created for it, so `#/guides/changelog` currently has no document. |

---

## 7. Sprites

`scripts/fetch-sprites.mjs` downloads `public/sprites/<dex>.png` for dex 1–493.
**Result: 493 / 493 present — there are no expected gaps.** Every file was validated as a
96×96 PNG with a plausible size, there are no leftover `.tmp` files, and a re-run reports
`requested 493 / downloaded 0 / skipped 493 / failed 0` (proving idempotency).

An earlier snapshot of this directory held only 470 files because
`raw.githubusercontent.com` began stalling (connections hang rather than 404) after roughly 350
downloads. The final 23 (`56-73`, `75`, `78`, `82`, `123`, `144`) were then fetched through
jsDelivr, and all 23 were subsequently re-fetched from jsDelivr and `md5sum`-compared against
the files on disk: **23/23 byte-identical**.

Sources, tried in order until one succeeds:

1. `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/<dex>.png` — the same
   repository over a CDN that does not throttle bursts.
2. `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/<dex>.png` — the URL
   named by `docs/DATA-SCHEMA.md`; reliable for the first few hundred requests, then stalls.
3. `https://api.github.com/repos/PokeAPI/sprites/contents/sprites/pokemon/<dex>.png` — returns the
   same blob base64-encoded, limited to 60 requests/hour unauthenticated.

Byte-identity of the three sources was verified with `md5sum`:

| Check | Files compared | Result |
| --- | --- | --- |
| GitHub contents API vs. CDN-fetched copies | 1, 200, 359, 493 | identical |
| jsDelivr vs. CDN-fetched copies | 1, 2, 100, 359, 493 | identical |

Idempotent: files that exist and are non-empty are skipped, downloads go through a configurable
concurrency pool (default 6), each failure is retried twice, and the bytes are written to a
`.tmp` file before being renamed so an interrupted run never leaves a truncated sprite behind.
`--source=`, `--concurrency=`, `--retries=`, `--delay=` and `--timeout=` are available for
awkward networks.

Because the hack's own sprites are not redistributable, the *original* species sprite is used for
Sinnohan forms too; the UI must render those with an `S` badge.

> **Environment note.** During this session the sandbox's egress proxy reset every connection to
> `raw.githubusercontent.com` after roughly 350 successful downloads (`curl` fails at the TLS
> handshake with "Connection reset by peer") while other hosts kept working. That is why the
> script gained the jsDelivr and GitHub-API fallbacks; the final seven sprites came from
> jsDelivr, and were then byte-verified against the CDN content.

## 8. Search index

`search-index.json` holds 1 433 `SearchRecord`s:

| Kind | Records | Coverage |
| --- | ---: | --- |
| `pokemon` | 493 | one per entry; `body` carries old/new types, stats, abilities, move notes, every form, and the **full learnset** (level-up + TM + tutor move names) |
| `item` | 332 | usable, cost, TM, mart, store, item location, TM location, vitamin, plate and replaced-item rows |
| `move` | 152 | 10 new moves, 29 replacements, 113 modifications |
| `wild` | 96 | one per area; `body` lists every method and slot |
| `trainer` | 87 | one per **area** (not per trainer line); `body` holds the full roster, rematches and every boss set with moves |
| `type` | 73 | 69 Pokémon type changes + 4 chart cells |
| `sinnohan` | 65 | one per form |
| `event` | 49 | one per event entry |
| `evolution` | 48 | one per evolution bullet |
| `doc` | 14 | one per source document |
| `faq` / `npc` / `trade` / `guide` | 9 / 7 / 4 / 4 | FAQ, NPC sections, trades, level caps + Action Replay |

Because every Pokémon record lists its learnset, queries such as
`who learns Boomburst?` resolve to Pidgeot, Jigglypuff, Wigglytuff, Swellow, Exploud, Chimecho,
Kricketune and Chatot (13 records mention Boomburst in total, including the move and
modification records).

Routes used: `#/pokemon/<slug>`, `#/sinnohan/<slug>` and the document routes in
`meta.json`; all 1 433 routes were asserted against the app's route list.

---

## 9. rev 3 — types and alternate forms

Contract revision 3 (`src/types/data.ts`) added `PokemonChange.baseTypes` +
`baseTypesSource`, and `FormVariant.types`. This section reports what that meant for
the pipeline, the two systematic type cross-checks it made possible, and the two
decisions the sources forced.

Everything below is reproducible with:

```bash
node scripts/fetch-baseline.mjs   # once: +26 `pokemon-form` responses (network)
node scripts/build-data.mjs       # prints the whole cross-check table
node tools/audit.mjs              # ALL HARD CHECKS PASSED
npm run check:contract            # tsc against src/types/data.ts
```

> **Superseded numbers.** §1/§2/§8 above were written for the previous revision. The
> current build emits `pokemon.json` 1 607 294 B (493 records), `sinnohan.json`
> 252 810 B, `search-index.json` 1 405 records / 887 392 B, 3 333 484 B in total.
> Only **+31 302 B** of `pokemon.json` comes from rev 3 itself — measured by rebuilding the
> file without the new fields; as JSON fragments they are `baseTypes` + `baseTypesSource`
> 27 718 B, `FormVariant.types` 280 B and the form-change notes 3 560 B — so the rest of
> the difference against §1 predates this revision. `pokemonWithStatChange` rose 229 → 230
> because Rotom's stat change moved from a pseudo-form to the species.

### 9.1 `baseTypes` — 493 / 493 entries

`PokemonChanges.txt` re-types only 69 species. The other 424 — every legendary among
them — had no type at all, so their detail page showed none. `baseTypes` is now filled
for all 493 entries from the vanilla baseline, with `baseTypesSource: "baseline"`.

The typing recovered is the **Generation-IV** one, not PokeAPI's current typing: the
same `genFourTypes()` helper used for `SinnohanForm.replacedTypes` reads
`past_types[]` and takes the earliest entry whose `generation` is ≥ 4, so the Gen-VI
Fairy retcon cannot leak in.

| Entry | `baseTypes` | Note |
| --- | --- | --- |
| `Arceus` | `Normal` | legendary the documents never re-type — previously no type shown |
| `Charizard` | `Fire / Flying` | the *changed* type stays `Fire/Dragon` in `type`; `baseTypes` is the vanilla pair |
| `Togetic` | `Normal / Flying` | not `Fairy / Flying`: PokeAPI's `past_types` (`generation-v: normal/flying`) wins |
| `Granbull` | `Normal` | current PokeAPI typing is `Fairy`; Gen IV is `Normal` |
| `Ambipom` (dex 424, Sinnohan) | `Normal` | equals `SinnohanForm.replacedTypes` for the same dex |

The 65 Sinnohan entries in `pokemon.json` are asserted to have
`baseTypes === sinnohan.json[dex].replacedTypes` (0 mismatches), because both are read
from the same baseline lookup — that is what makes the `Sinnohan Ambipom` case
(`Normal → Normal / Fighting`) consistent across the two files.

New assertions: `every PokemonChange has baseTypes` (493/493),
`every baseTypesSource is baseline`, `every baseTypes is a non-empty list of valid PType`
(the global "every type name is a valid PType" check now also covers `baseTypes`,
`FormVariant.types`, `SinnohanForm.replacedTypes` and the form names).

### 9.2 Sinnohan forms — the documents vs the baseline (all 65)

`replacedTypes` is the replaced species' Gen-IV typing (baseline); "documented form" is
the form's own typing as written in `SinnohanForms.txt`. Relation labels:

* **superset** — the form keeps every base type and adds one (`Ambipom`).
* **partial-overlap** — at least one type is shared, one is swapped.
* **full-retype** — no type is shared with the replaced species.
* **subset** — a base type was dropped without a replacement. **None occur.**

This is a review list, not an error list: Sinnohan forms legitimately retype from
scratch. It was checked by hand against the source and the documented column matches
`SinnohanForms.txt` verbatim for **65/65** forms (independent re-parse).

| dex | form | replaced (baseline, Gen IV) | documented form | relation |
| --- | --- | --- | --- | --- |
| 010 | Sinnohan Caterpie | Bug | Bug / Fairy | superset |
| 011 | Sinnohan Metapod | Bug | Bug / Fairy | superset |
| 012 | Sinnohan Butterfree | Bug / Flying | Bug / Fairy | partial-overlap |
| 013 | Sinnohan Weedle | Bug / Poison | Bug / Electric | partial-overlap |
| 014 | Sinnohan Kakuna | Bug / Poison | Bug / Electric | partial-overlap |
| 015 | Sinnohan Beedrill | Bug / Poison | Bug / Electric | partial-overlap |
| 026 | Sinnohan Raichu | Electric | Electric / Ice | superset |
| 027 | Sinnohan Sandshrew | Ground | Rock | full-retype |
| 028 | Sinnohan Sandslash | Ground | Rock | full-retype |
| 046 | Sinnohan Paras | Bug / Grass | Poison / Fairy | full-retype |
| 047 | Sinnohan Parasect | Bug / Grass | Poison / Fairy | full-retype |
| 058 | Sinnohan Growlithe | Fire | Ice | full-retype |
| 059 | Sinnohan Arcanine | Fire | Ice | full-retype |
| 077 | Sinnohan Ponyta | Fire | Water / Fairy | full-retype |
| 078 | Sinnohan Rapidash | Fire | Water / Fairy | full-retype |
| 123 | Sinnohan Scyther | Bug / Flying | Bug / Ice | partial-overlap |
| 212 | Sinnohan Scizor | Bug / Steel | Steel / Ice | partial-overlap |
| 137 | Sinnohan Porygon | Normal | Electric | full-retype |
| 233 | Sinnohan Porygon2 | Normal | Electric | full-retype |
| 474 | Sinnohan Porygon-Z | Normal | Electric | full-retype |
| 147 | Sinnohan Dratini | Dragon | Water / Dragon | superset |
| 148 | Sinnohan Dragonair | Dragon | Water / Dragon | superset |
| 149 | Sinnohan Dragonite | Dragon / Flying | Water / Dragon | partial-overlap |
| 161 | Sinnohan Sentret | Normal | Normal / Ice | superset |
| 162 | Sinnohan Furret | Normal | Normal / Ice | superset |
| 163 | Sinnohan Hoothoot | Normal / Flying | Ice / Flying | partial-overlap |
| 164 | Sinnohan Noctowl | Normal / Flying | Ghost / Flying | partial-overlap |
| 167 | Sinnohan Spinarak | Bug / Poison | Bug / Dark | partial-overlap |
| 168 | Sinnohan Ariados | Bug / Poison | Bug / Dark | partial-overlap |
| 170 | Sinnohan Chinchou | Water / Electric | Water / Ghost | partial-overlap |
| 171 | Sinnohan Lanturn | Water / Electric | Water / Ghost | partial-overlap |
| 175 | Sinnohan Togepi | Normal | Grass | full-retype |
| 176 | Sinnohan Togetic | Normal / Flying | Grass / Dragon | full-retype |
| 468 | Sinnohan Togekiss | Normal / Flying | Grass / Dragon | full-retype |
| 179 | Sinnohan Mareep | Electric | Grass / Normal | full-retype |
| 180 | Sinnohan Flaaffy | Electric | Grass / Normal | full-retype |
| 181 | Sinnohan Ampharos | Electric | Grass / Normal | full-retype |
| 190 | Sinnohan Aipom | Normal | Normal / Fighting | superset |
| 424 | Sinnohan Ambipom | Normal | Normal / Fighting | superset |
| 204 | Sinnohan Pineco | Bug | Flying | full-retype |
| 205 | Sinnohan Forretress | Bug / Steel | Flying / Electric | full-retype |
| 206 | Sinnohan Dunsparce | Normal | Ground / Steel | full-retype |
| 218 | Sinnohan Slugma | Fire | Poison | full-retype |
| 219 | Sinnohan Magcargo | Fire / Rock | Poison / Steel | full-retype |
| 261 | Sinnohan Poochyena | Dark | Psychic / Fairy | full-retype |
| 262 | Sinnohan Mightyena | Dark | Psychic / Fairy | full-retype |
| 304 | Sinnohan Aron | Steel / Rock | Steel / Fire | partial-overlap |
| 305 | Sinnohan Lairon | Steel / Rock | Steel / Fire | partial-overlap |
| 306 | Sinnohan Aggron | Steel / Rock | Steel / Fire | partial-overlap |
| 307 | Sinnohan Meditite | Fighting / Psychic | Flying / Fighting | partial-overlap |
| 308 | Sinnohan Medicham | Fighting / Psychic | Flying / Fighting | partial-overlap |
| 309 | Sinnohan Electrike | Electric | Rock | full-retype |
| 310 | Sinnohan Manectric | Electric | Rock / Psychic | full-retype |
| 406 | Sinnohan Budew | Grass / Poison | Fairy | full-retype |
| 315 | Sinnohan Roselia | Grass / Poison | Fairy / Fighting | full-retype |
| 407 | Sinnohan Roserade | Grass / Poison | Fairy / Fighting | full-retype |
| 328 | Sinnohan Trapinch | Ground | Fire | full-retype |
| 329 | Sinnohan Vibrava | Ground / Dragon | Fire / Electric | full-retype |
| 330 | Sinnohan Flygon | Ground / Dragon | Fire / Electric | full-retype |
| 333 | Sinnohan Swablu | Normal / Flying | Psychic / Flying | partial-overlap |
| 334 | Sinnohan Altaria | Dragon / Flying | Psychic / Dragon | partial-overlap |
| 337 | Sinnohan Lunatone | Rock / Psychic | Rock / Ghost | partial-overlap |
| 338 | Sinnohan Solrock | Rock / Psychic | Fire / Ghost | full-retype |
| 357 | Sinnohan Tropius | Grass / Flying | Grass / Fire | partial-overlap |
| 359 | Sinnohan Absol | Dark | Dark / Steel | superset |

**65 forms: superset 10, partial-overlap 22, full-retype 33, subset 0.**

The 33 full retypes split cleanly into the hack's own design themes and need no action:
Sandshrew/Sandslash → `Rock`, Growlithe/Arcanine → `Ice`, Ponyta/Rapidash → `Water/Fairy`,
Porygon line → `Electric`, Togepi line → `Grass`/`Grass+Dragon`, Mareep line → `Grass`,
Pineco/Forretress → `Flying(+Electric)`, Slugma/Magcargo → `Poison(+Steel)`,
Poochyena/Mightyena → `Psychic/Fairy`, Electrike/Manectric → `Rock`, Budew/Roselia/Roserade
→ `Fairy`, Trapinch line → `Fire`, Solrock → `Fire/Ghost`. Each is a deliberate regional
reinvention, consistent with the Sinnohan prose in `SinnohanForms.txt`.

### 9.3 `TypeChanges.txt` — the stated `Old` type vs vanilla Platinum (69 rows)

The table states both types explicitly, so its `Old` column must equal the baseline's
Gen-IV typing. **68 of 69 rows match; exactly one does not:**

| dex | Pokémon | document `Old` | baseline Gen IV | PokeAPI current | diagnosis |
| --- | --- | --- | --- | --- | --- |
| 210 | Granbull | `Fairy` | `Normal` | `Fairy` | the document states the **modern (Gen VI+)** typing |

Investigation, honestly reported:

* Granbull is the **only** row whose `Old` contains `Fairy`, and the only one of the 69
  whose Gen-IV typing differs from PokeAPI's current typing. In vanilla Platinum Granbull
  is `Normal` (it became `Fairy` in Gen VI); the row reads
  `#210 Granbull  Fairy  Fairy / Fighting  Threatening appearance, learns many Fighting
  moves already.`
* It is therefore **not** an earlier-generation typing — the document is "a generation
  ahead" of Platinum, using the modern typing as its starting point. The stated change
  (`Fairy → Fairy / Fighting`) is still internally consistent, and
  `PokemonChanges.txt` agrees with `TypeChanges.txt` on the *new* typing for all 69 rows
  (cross-document check: 0 disagreements).
* No row of the corpus states a **pre-Gen-IV** typing (`Magnemite`-style retcons do not
  appear in the table).
* Nothing is "corrected": documented values win, the row is emitted verbatim, and the
  mismatch is reported here and by every build.

New hard assertions: `every TypeChanges oldTypes is a non-empty list of valid PType` and
`every SinnohanForm.replacedTypes is a non-empty list of valid PType` (both 0 invalid).

### 9.4 Alternate forms — `FormVariant.types`, and how the form list was completed

`/pokemon/<dex>` carries only the species' default typing, so no alternate form had a
type anywhere in the cache. The fetcher now caches 26 `/pokemon-form/<slug>` responses
(`form-<slug>.json`, +26 requests, offline afterwards) for the eight species the codex
lists forms for, and `derived.json` gained a `forms` projection (`cacheVersion` 1 → 2).

**Rotom (the reported bug).** `Base Stats (Regular Form)` was buried in a pseudo-form
named `Regular Form`, so Rotom's page had an empty stat comparison:

| | before | after |
| --- | --- | --- |
| `stats` | `undefined` | `440 → 520 BST` (50/50/77/95/77/91 → 50/65/107/105/107/86) |
| `forms[]` | `["Fan Rotom", "Regular Form"]` | `Heat, Wash, Frost, Fan, Mow Rotom` — no pseudo-form |
| `ability` | `undefined` | still `undefined` (Rotom's own ability is unchanged) |
| `forms[Fan Rotom].ability` | `Levitate → Motor Drive` | unchanged |

The five alternate forms carry their Gen-V secondary types, exactly as
`TypeChanges.txt` states the rule, resolved from the baseline rather than hard-coded:

| form | types | source |
| --- | --- | --- |
| Heat Rotom | `Electric / Fire` | `pokemon-form/rotom-heat` |
| Wash Rotom | `Electric / Water` | `pokemon-form/rotom-wash` |
| Frost Rotom | `Electric / Ice` | `pokemon-form/rotom-frost` |
| Fan Rotom | `Electric / Flying` | `pokemon-form/rotom-fan` (merged with the document's `Ability (Fan Rotom)`) |
| Mow Rotom | `Electric / Grass` | `pokemon-form/rotom-mow` |

The other seven species, all resolved from the baseline:

| dex | species | `baseTypes` | forms listed with their types |
| --- | --- | --- | --- |
| 351 | Castform | Normal | Sunny `Fire`, Rainy `Water`, Snowy `Ice` |
| 386 | Deoxys | Psychic | Normal/Attack/Defense/Speed Forme `Psychic` |
| 412 | Burmy | Bug | Sandy `Bug`, Trash `Bug` |
| 413 | Wormadam | Bug / Grass | Plant `Bug/Grass`, Sandy `Bug/Ground`, Trash `Bug/Steel` |
| 421 | Cherrim | Grass | Sunshine `Grass` |
| 479 | Rotom | Electric / Ghost | Heat/Wash/Frost/Fan/Mow (table above) |
| 487 | Giratina | Ghost / Dragon | Origin `Ghost/Dragon` |
| 492 | Shaymin | Grass | Land `Grass`, Sky `Grass/Flying` |

21 of the 22 emitted form variants carry `types`; the 22nd is Eevee's `All Evolutions`
(§9.5). Ten of them were **matched** to a form scope declared by the document, eleven
were **added** from the baseline because no document mentions the form at all (Castform's
weather forms, Burmy's cloaks, Giratina's Origin Forme, Cherrim's Sunshine Form, four of
Rotom's appliances).

The join cannot use names directly: the documents write `Plant Cloak` where PokeAPI
writes `Plant Wormadam`, and `Normal Forme` where it writes `Normal Deoxys`. The form
*token* is the join key (`formToken('wormadam-plant') = 'plant'` ⊂ `plantcloak`), and an
ambiguous or unmatched scope is never guessed — it keeps the document's label and stays
without types, with a warning. Nothing in the corpus hits that path.

A form the documents never mention is added under PokeAPI's English name
(`Origin Giratina`, `Sunny Castform`, `Sandy Burmy`). The species' **default** form is
never added as a variant: it *is* the species, and its typing is `baseTypes` (asserted:
each species' default form's types equal its `baseTypes`). It is listed as a variant only
when the document itself scopes a section to it — Deoxys' `Normal Forme`, Wormadam's
`Plant Cloak`, Shaymin's `Land Forme`.

**"How to change form" is not documented.** All 14 documents were searched for every
form-change mechanic (Secret Key, Gracidea, appliances, Rotom Room, "change form",
"forme"): there is no such section. Rather than inventing one, the eight form-bearing
entries now carry a pipeline note in `sections[]`
(`Form Change (pipeline note)`), explicitly marked as *not source text*, saying the
mechanism is undocumented here and pointing at `SpecialEvents.txt` / `events.json` for
where the Pokémon is obtained (Rotom: the television in the Old Chateau). This is what
`src/types/data.ts` has no field for — see §9.7.

### 9.5 The form-scope decisions (audited, one by one)

All 22 form-scoped sections in `PokemonChanges.txt` were reviewed:

| entry | scope | decision | reason |
| --- | --- | --- | --- |
| 479 Rotom | `Base Stats (Regular Form)` | **promoted to species-level `stats`**; the `Regular Form` variant is dropped | "Regular Form" is not a form of Rotom, it is Rotom: the entry declares a single `Base Stats` scope and the five appliance forms are the alternates |
| 479 Rotom | `Ability (Fan Rotom)` | stays a variant | genuinely Fan Rotom's only |
| 479 Rotom | `Type:` prose (`All of Rotom's formes match their types as of Gen V.`) | kept in `sections[]` (typed field would need invented semantics — §9.7) | not an `Old`/`New` pair; it is the *rule* behind the five typings |
| 133 Eevee | `Base Stats(All Evolutions)` | **stays a variant** | it names a group of *other* Pokémon ("Eeveelutions all use the same set of base stats, distributed differently"), so it is not Eevee's stat change and cannot be attributed to Eevee; its 525 → 545 spread stays visible as the `All Evolutions` variant, and Eevee's own `baseStats` comes from the baseline |
| 386 Deoxys | `Level Up (Normal/Attack/Defense/Speed Forme)` | all four stay variants | a *parallel* per-form set: no member of it is the species, and each forme's documented learnset must stay listed (Problem 4 asks for all four) |
| 413 Wormadam | `Base Stats (Plant/Sandy/Trash Cloak)`, `Level Up (...)` | all three stay variants | same parallel-set rule; promoting Plant Cloak would present one cloak's spread as the species' |
| 492 Shaymin | `Level Up (Land Forme)`, `Level Up (Sky Forme)` | both stay variants | same parallel-set rule |

The rule implemented (`scripts/lib/pokemon.mjs`): a section scoped to a name the source
uses as an alias for the species itself (`Regular Form`, `Normal Form`, `Default Form`,
`Standard Form`, `Base Form`) is promoted **only when the entry declares exactly one
scope for that label**. That is the reason Deoxys/Shaymin/Wormadam are unaffected by the
promotion: their two-to-four scopes make the block a deliberate per-form breakdown, and
each keeps its own label. The promotion is reported by every build
(`rev 3 — form-scoped sections read as species-level`).

Two open questions left for the author rather than decided silently:

1. Deoxys, Shaymin and Wormadam therefore have a **baseline-filled** species-level
   learnset (Vanilla reference values, flagged `includesBaseline: true`) while their
   *documented* learnsets sit under the form cards. That is faithful to the source (the
   author wrote per-form lists and no form-neutral one) but a reader who never opens a
   form card sees a vanilla list. Deciding otherwise is a one-line change to
   `SPECIES_SCOPE_ALIASES`.
2. Species with a documented *default* form that the source never scopes (none today)
   would follow the same single-scope rule.

Species deliberately **not** listed as alternate forms, with reasons: Unown (28 letters),
Shellos/Gastrodon (East/West Sea), Mothim (plant/sandy/trash), Spiky-eared Pichu — all
purely cosmetic varieties whose typing equals the species' `baseTypes`; and Arceus's 18
plate forms, which are plate-driven and already covered by the documented plate locations
in `ItemChanges.txt`. Adding any of them is a one-line entry in `FORM_VARIANTS`
(`scripts/lib/baseline.mjs`).

### 9.6 Assertions added by rev 3 (all PASS)

```
PASS  every PokemonChange has baseTypes                     493/493
PASS  every baseTypesSource is baseline                     0 invalid
PASS  every baseTypes is a non-empty list of valid PType    0 invalid
PASS  every TypeChanges oldTypes is a non-empty list of valid PType        0 invalid
PASS  every SinnohanForm.replacedTypes is a non-empty list of valid PType  0 invalid
PASS  Sinnohan entries: baseTypes === replacedTypes         0 mismatches
PASS* every alternate form is listed with its types         Castform 3, Deoxys 4, Burmy 2, Wormadam 3,
                                                            Cherrim 1, Rotom 5, Giratina 1, Shaymin 2
PASS  Arceus.baseTypes === [Normal]                         Normal
PASS  Charizard.baseTypes === [Fire, Flying]                Fire / Flying
PASS  Rotom: stats species-level (440 -> 520), no "Regular Form" pseudo-form
PASS  Rotom: five alternate forms with their Gen-V types     Heat/Wash/Frost/Fan/Mow
PASS  Rotom: Fan Rotom keeps Levitate -> Motor Drive
```

Cross-check tables are printed in full by `node scripts/build-data.mjs` under
`TYPE CROSS-CHECKS (review lists — printed in full, never asserted)` and are deliberately
**not** assertions: they encode reviewer judgement, not mechanical invariants.

Determinism was re-verified after the change: two consecutive builds produce byte-identical
`public/data/*.json` (`md5sum` diff empty).

### 9.7 Contract problems found (not fixed here — `src/types/data.ts` is owned by the author)

1. **No home for a `meta`-level note.** Problem 4 asked for a note that the form-change
   mechanism is undocumented, "at `meta` level or as a `sections` entry". `MetaDoc` has no
   free-form field (`documents[].generalNotes` is verbatim source prose, `counts` is
   numeric), so the note went into each affected entry's `sections[]`, marked
   `Form Change (pipeline note)` and prefixed *"Pipeline note — not source text"*. A clean
   fix would be `MetaDoc.formChanges?: { documented: false; note: string }`.
2. **No counters for the new enrichment.** `MetaDoc.enrichment` has exactly
   `statsFilled`/`tmFilled`/`tutorFilled`/`levelUpFilled`, so the rev-3 numbers
   (`baseTypesFilled` 493, `formTypesFromDocument` 10, `formsSynthesized` 11,
   `formChangeNotes` 8) are printed by the build but cannot be recorded in `meta.json`
   without extending the frozen interface.
3. **`Type:` prose has no typed field.** Rotom's `All of Rotom's formes match their types
   as of Gen V.` is preserved verbatim in `sections[]` (reachable, not lost) but is not
   first-class. Proposed rather than invented: `PokemonChange.typeNote?: string` for a
   `Type:` section that is prose instead of an `Old`/`New` pair — exactly one occurrence
   in the corpus (dex 479). No semantics were invented here.
4. **The UI does not read the new fields yet.** `src/lib/data.ts` passes
   `FormVariant.types` through, but `PokemonDetail.tsx`'s `FormVariantCard` renders
   `form`/`ability`/`stats`/`moves`/`levelUp` only, and the Quick-reference "Types" block
   still falls back to "Not changed in this document" when `type` is absent — so
   `baseTypes` is currently unused by the app. Data-side fix only; the frontend still has
   to render `entry.baseTypes ?? entry.type?.new`.

---

## 10. rev 4 — the species' *own default form* is promoted, not turned into a pseudo-form

Rev 3 promoted a form scope only when it was a **generic alias** for the species
(`Regular Form`, `Normal Form`, `Default Form`, …) *and* the entry declared a single scope
for that label. That fixed Rotom, but it also blocked `Plant Cloak` on Wormadam, whose
`Base Stats` / `Level Up` / `Ability` sections are a three-way parallel set — so Wormadam's
own page had no stats, no ability and no documented level-up list, all three hidden inside
a pseudo-form called `Plant Cloak` that was listed as an "alternate form".

Rev 4 adds the missing half of the rule: **a scope that names the species' own default form
is the species**. The documents never say which cloak is Wormadam's default, but the
baseline does (`isDefault`: `wormadam-plant`, `deoxys-normal`, `shaymin-land`), and the
pipeline already treats the default form as the species everywhere else (`baseTypes` and
`baseStats` are read from it). `scripts/build-data.mjs` therefore injects
`isDefaultFormScope: (dex, scope) => matchesDefaultForm(baseline.formsAt(dex), scope)` into
`parsePokemonChanges`, and `scripts/lib/pokemon.mjs` checks the two cases in this order:

1. `isDefaultFormScope(dex, scope)` → promote **even inside a parallel set** (the siblings
   are the alternates, this one is the species);
2. `SPECIES_SCOPE_ALIASES.has(scope)` and the label declares a single scope → promote.
   `Regular Form` is not a form name of any kind, so with two or more scopes the block is a
   deliberate per-form breakdown and the alias is not trusted.

Everything else is unchanged: the promoted section still lands verbatim in `sections[]`, and
the promotion is reported by every build as
`rev 4 — form-scoped sections read as species-level`, with the reason per row.

### 10.1 Wormadam, before and after

| field | before (rev 3) | after (rev 4) |
| --- | --- | --- |
| `stats` | `undefined` | `60/59/85/79/105/36 (424 BST)` → `70/50/90/120/110/60 (500 BST)` — the Plant Cloak spread |
| `ability` | `undefined` | `Anticipation` → `Chlorophyll / Unaware` (the Plant Cloak ability) |
| `learnset.levelUp` | 13 entries, all **baseline** (vanilla Plant Cloak, `includesBaseline`) | 17 entries, the **documented** Plant Cloak list (6 of them `>>` replacements) |
| `moves` | 1 note (TM62 Bug Buzz) | unchanged — the `Moves:` section is unscoped |
| `forms[]` | `["Plant Cloak", "Sandy Cloak", "Trash Cloak"]` | `["Sandy Cloak", "Trash Cloak"]` |
| `Sandy Cloak` | `Bug / Ground`, `424 → 500`, 17 moves, 6 replacements | unchanged |
| `Trash Cloak` | `Bug / Steel`, `424 → 500`, 18 moves, 7 replacements, TM47 note | unchanged |
| `baseStats` / `baseStatsSource` | `424 BST` / `baseline` | `500 BST` / `documented` |
| `changeKinds` | `["moves","stats","ability","learnset"]` | `["stats","ability","moves","learnset"]` (same four kinds, canonical order) |

The 19 `>>` replacements are still exactly 19, and the build now prints where each lives:

```
PASS* LearnEntry.replaces count        expected 19   actual 19
      ↳ Wormadam cloaks — Wormadam (species-level learnset): 6, Wormadam — Sandy Cloak: 6, Wormadam — Trash Cloak: 7
```

The distribution changed legitimately (6 moved from a form to the species) because the
Plant Cloak list *is* Wormadam's list; the assertion itself already summed both places, so
its body was kept and only its note and comment were extended to show the split, which is
what makes a future lost or duplicated `>>` visible. `tools/audit.mjs`'s equivalent check
(species-level + form-level) also still reports 19.

### 10.2 The complete form-scope audit

Every form-scoped section in the corpus (16 in `PokemonChanges.txt`), the three scoped
`New(…)` lines inside Wormadam's shared `Ability:` section, and the four species the
candidate list named that turn out to have no scoped section at all:

| # | species | section / scope | decision | why |
| --- | --- | --- | --- | --- |
| 1 | 133 Eevee | `Base Stats(All Evolutions)` | **stays a variant** | it names a group of *other* Pokémon ("Eeveelutions all use the same set of base stats, distributed differently"), so the 525 → 545 spread is not Eevee's own change; `Eevee.stats` stays unset and its `baseStats` come from the baseline (asserted) |
| 2 | 386 Deoxys | `Level Up (Normal Forme)` | **promoted** (new in rev 4) | Normal Forme *is* the default: PokeAPI's unsuffixed `pokemon/386` is `deoxys-normal`, and the species' vanilla stats and typing are that forme's; the other three are the alternates |
| 3 | 386 Deoxys | `Level Up (Attack \| Defense \| Speed Forme)` | stay variants | genuine alternates (`deoxys-attack/defense/speed`), each keeping its own documented list |
| 4 | 413 Wormadam | `Base Stats (Plant Cloak)` | **promoted** | Plant Cloak is the default cloak (`wormadam-plant`) and the species' vanilla typing (`Bug/Grass`) and stats are its |
| 5 | 413 Wormadam | `Level Up (Plant Cloak)` | **promoted** | same rule: the cloak the species has by default learns this list |
| 6 | 413 Wormadam | `New(Plant Cloak) …` (inside the shared `Ability:`) | **promoted** | same scope, same rule, applied to a scoped *line* rather than a scoped section — it fills `Wormadam.ability` |
| 7 | 413 Wormadam | `Base Stats (Sandy Cloak)`, `Level Up (Sandy Cloak)`, `New(Sandy Cloak) …` | stay variants | real alternate cloak, `Bug / Ground` (`wormadam-sandy`) |
| 8 | 413 Wormadam | `Base Stats (Trash Cloak)`, `Level Up (Trash Cloak)`, `Moves (Trash Cloak)`, `New(Trash Cloak) …` | stay variants | real alternate cloak, `Bug / Steel` (`wormadam-trash`); also the only form-scoped `Moves:` section in the corpus |
| 9 | 479 Rotom | `Base Stats (Regular Form)` | **promoted** (rev 3) | "Regular Form" is not a form of Rotom at all, it is Rotom; the entry declares a single `Base Stats` scope |
| 10 | 479 Rotom | `Ability (Fan Rotom)` (+ the four synth. appliances) | stay variants | Fan Rotom is a real alternate (`rotom-fan`, `Electric / Flying`) and its ability change is Fan Rotom's only |
| 11 | 492 Shaymin | `Level Up (Land Forme)` | **promoted** (new in rev 4) | Land Forme *is* the default (`shaymin-land`, `Grass`), so its list is the species' list |
| 12 | 492 Shaymin | `Level Up (Sky Forme)` | stays a variant | genuine alternate (`shaymin-sky`, `Grass / Flying`) |
| 13 | 487 Giratina | — no form-scoped section — | nothing to decide | `Altered Forme` is indeed the default (`giratina-altered`), but the document never scopes a section to it: its `Held Item:`/`Moves:`/`Level Up:` are species-level, and Origin Forme appears only as a baseline-added variant |
| 14 | 412 Burmy | — no form-scoped section — | nothing to decide | `Plant Cloak` is the default (`burmy-plant`) and Burmy's `Ability:`/`Base Stats:`/`Level Up:` are unscoped; Sandy and Trash Burmy are baseline-added variants |
| 15 | 351 Castform | — no form-scoped section — | nothing to decide | all three of its sections are unscoped; Sunny/Rainy/Snowy Castform are baseline-added variants |
| 16 | 421 Cherrim | — no form-scoped section — | nothing to decide | Overcast Cherrim is the default (`cherrim-overcast`) and its sections are unscoped; Sunshine Cherrim is a baseline-added variant |

So of the four species the candidate list flagged as "its default is X", **Giratina and Burmy
need no decision at all** (their documents never scope a section to a form), while
**Deoxys and Shaymin are structurally identical to Wormadam** — a parallel per-form set whose
members include the species' own default — and therefore get the same treatment. A one-line
revert is available for any single species if the author disagrees: dropping its default
scope from the promotion is a case in `matchesDefaultForm`'s call site, and removing a name
from `SPECIES_SCOPE_ALIASES` reverts Rotom.

### 10.3 What the promotion changed in the emitted data

| dex | entry | before | after |
| --- | --- | --- | --- |
| 413 | Wormadam | `stats`/`ability` unset; 13 baseline level-up entries; 3 forms | Plant Cloak spread + ability + 17 documented level-up entries; 2 forms |
| 386 | Deoxys | 14 **baseline** level-up entries (`deoxys-normal` vanilla); 4 forms | 14 **documented** Normal Forme entries; 3 forms |
| 492 | Shaymin | 12 **baseline** level-up entries (`shaymin-land` vanilla); 2 forms | 14 **documented** Land Forme entries; 1 form |
| 479 | Rotom | (unchanged from rev 3) | 5 appliance forms, species-level stats |
| 133 | Eevee | `All Evolutions` variant, no species stats | unchanged |

Corpus-wide: 22 form variants → **19** (18 of them typed, down from 21), 10 scoped matches →
**7**, 11 baseline-synthesised forms unchanged, 8 baseline form species + Eevee unchanged.
`meta.counts` moves with it: `pokemonWithStatChange` 230 → **231** and
`pokemonWithAbilityChange` 313 → **314** (Wormadam's are now species-level, so the entry
counts), `enrichment.statsFilled` 263 → **262** and `enrichment.levelUpFilled` 68 → **65**
(three entries no longer need a baseline list). Search index: still 1405 records; Wormadam's
body now opens with its stats, ability and Plant Cloak move list, and Deoxys/Shaymin list
their documented default-form learnset where the vanilla list used to be.

### 10.4 Verification

```
node scripts/build-data.mjs   → exit 0, 54 assertion lines, 0 FAIL
node tools/audit.mjs          → ALL HARD CHECKS PASSED (1 soft warning — unchanged)
```

Seven assertions were added for this change (all PASS): Wormadam's stats are the Plant Cloak
spread, its ability is the Plant Cloak ability, its species-level level-up list is non-empty,
its `forms[]` is exactly `Sandy Cloak (Bug/Ground)` + `Trash Cloak (Bug/Steel)`, Deoxys keeps
exactly `Attack/Defense/Speed Forme`, Shaymin exactly `Sky Forme`, and Eevee's
`All Evolutions` is still a variant with no species-level stats. The existing
`every alternate form is listed with its types` check was tightened from `>=` to `===`
(`listed.length === alternates.length`), which is now exact and would catch a promoted
alternate *or* a re-introduced default-form variant.

Nothing is dropped, proven mechanically by parsing `PokemonChanges.txt` twice — once with
the default-form half of the rule and once without it (i.e. rev-3 semantics):

```
unparsed before (rev 3 parse): 16 | after (rev 4 parse): 16
identical unparsed sets: true
rawSections identical for whole corpus: true
```

Determinism (two consecutive builds, digest = `cd public/data && md5sum *.json | md5sum`)
and footprint:

```
run1: 1501ad81c1faf169ad3d6866ffcb4bae  -      # byte-identical across runs
run2: 1501ad81c1faf169ad3d6866ffcb4bae  -
```

Exactly three of the thirteen files differ from the previous build —
`pokemon.json` (1 605 342 B, `f7f600891b82d0a6bd7b55fd48b6cc20`),
`meta.json` (16 148 B, `08b54d5d93b3f083630dfc049b87978f`) and
`search-index.json` (887 005 B, `bfa066c867f9c13e9e894ee691ccd74b`); the other ten are
byte-identical to their rev-3 hashes.

### 10.5 Superseded in this document

* §9.4's form counts (22 variants / 21 typed / 10 scoped matches) and its closing sentence
  ("It is listed as a variant only when the document itself scopes a section to it —
  Deoxys' `Normal Forme`, Wormadam's `Plant Cloak`, Shaymin's `Land Forme`") describe rev 3.
  The current numbers are in §10.3.
* §9.5's table rows for **386 Deoxys**, **413 Wormadam** and **492 Shaymin** said "all stay
  variants"; §10.2 replaces those three rows. The Eevee and Rotom rows still stand.
* §9.5's open question 1 ("Deoxys, Shaymin and Wormadam therefore have a baseline-filled
  species-level learnset … Deciding otherwise is a one-line change to
  `SPECIES_SCOPE_ALIASES`") is now **decided**: the documented default-form list wins, so
  those three no longer carry a vanilla list at species level. Open question 2 still stands —
  no species in the corpus has a documented default form the source never scopes.
