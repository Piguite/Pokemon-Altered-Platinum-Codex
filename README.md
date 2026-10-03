# Altered Platinum Codex

An interactive, fully searchable companion for the **Pokémon Altered Platinum** documentation —
Drayano's hard-mode *Pokémon Platinum* ROM hack, version **r1.0.5**.

Every change the hack documents — 493 Pokémon entries, 65 Sinnohan forms, 134 type changes (69
documented rows in `TypeChanges.txt` + 65 Sinnohan retypings), 774 trainer lines, 96 wild areas,
every move, item, evolution and event — is parsed out of the original plain-text documents into
typed JSON and browsable in a React app, with a single search box over all of it.

The documents record *changes only*, so the site completes them with a **vanilla Platinum
baseline** (PokeAPI, filtered to the `platinum` version group): all 493 species end up with base
stats, and the site gains 477 TM/HM and 487 move-tutor lists that the documents never enumerate.
Documented values always win and every baseline value is labelled as such — see
[Vanilla Platinum baseline enrichment](#vanilla-platinum-baseline-enrichment).

## Why this exists

The documentation ships as three enormous PDFs. Reading them means scrolling through tens of
thousands of lines to answer one question:

The Codex keeps the documents' content, word for word, and replaces the scrolling with navigation,
filters and search.

### What you can browse

| Route | What it holds |
| --- | --- |
| `#/` | Dashboard: key figures, the author's general notes grouped by document, entry points |
| `#/pokemon`, `#/pokemon/<slug>` | All 493 Pokémon: types, base stats (old vs new, plus the resolved `baseStats`), abilities, held items, learnsets, forms |
| `#/sinnohan`, `#/sinnohan/<slug>` | The 65 Sinnohan regional forms, with the vanilla typing and stats they replace |
| `#/types` | The Ice type-chart rework, the 69 documented type changes plus the 65 Sinnohan forms that retype their species (134 entries in all), with the author's own type-chart image |
| `#/moves` | 29 move replacements, 10 new moves, 85 numeric-modification records (76 single-move + 9 grouped) |
| `#/items` | Costs, TMs, mart stock, item/TM/plate locations, replaced items |
| `#/evolutions` | Item-interaction, level and method evolution changes |
| `#/trainers` | Rosters by area plus 72 detailed boss teams (items, abilities, moves) |
| `#/wild` | Encounters by area, method and time of day |
| `#/events` | Gift, static and legendary encounters |
| `#/guides/*` | FAQ, NPC changes, in-game trades, level caps, Action Replay codes, changelog |
| `#/search` | Global search over 1 405 indexed records |

## Provenance of the source documents

The three Scribd links that started this project point at **the same documents that ship inside the
hack's own release archive**. Scribd only serves a JavaScript anti-bot challenge page instead of the
document text, so the original plain-text documentation was recovered from the release ZIP
(`Pokemon Altered Platinum r1.0.5.zip`) on the hack author's public Google Drive, and is preserved
**verbatim** in `data/source/`.

Those `.txt` files — not the PDFs derived from them, and not anything re-typed here — are the
authoritative versions of the documentation. All 14 of them (plus the author's
`typechart_new.png`) live alongside the code, so the dataset can always be re-derived from scratch
and audited against its own origin.

## Quick start

```bash
# 1. Install (see "Environment gotchas" below — this needs one export first)
export npm_config_cache="$PWD/.npm-cache"
npm install

# 2. Cache the vanilla Platinum baseline into .cache/pokeapi/ (network, first time only)
npm run baseline

# 3. Generate the JSON dataset into public/data/ (offline once the baseline is cached)
npm run data

# 4. Sprites into public/sprites/ (network needed only for sprites that are missing)
npm run sprites

# 5. Dev server — Vite prints the URL (http://localhost:5173/ by default)
npm run dev

# 6. Production build into dist/ — note that this re-runs the data pipeline first
npm run build

# 7. Serve the built site locally to check the production bundle
npm run preview
```

| Script | Command | Notes |
| --- | --- | --- |
| `npm run baseline` | `node scripts/fetch-baseline.mjs` | Fetches the vanilla Platinum baseline from PokeAPI into `.cache/pokeapi/`; **network on a cold cache, offline afterwards** |
| `npm run data` | `node scripts/build-data.mjs` | Offline, dependency-free, deterministic; **needs the baseline cache** (it fails with an explicit message when `.cache/pokeapi/` is missing) |
| `npm run check:contract` | `tsc --noEmit --strict … scripts/contract-check.ts` | Type-checks every generated JSON file against the frozen contract in `src/types/data.ts` |
| `npm run sprites` | `node scripts/fetch-sprites.mjs` | Downloads only what is missing; existing sprites are skipped |
| `npm run dev` | `vite` | Reads `public/data/` at runtime; no restart needed after a rebuild |
| `npm run build` | `npm run data && vite build` | **Regenerates the data first**, then bundles to `dist/` (it does *not* run `baseline`) |
| `npm run preview` | `vite preview` | Serves `dist/` |

The site is a pure static bundle: `base: './'` in `vite.config.ts` plus a `HashRouter` in
`src/App.tsx` mean every route is a `#/…` fragment, so `dist/` can be dropped on any static host or
subdirectory with no server rewrites.

## Environment gotchas

These two are real, reproducible, and will stop a fresh contributor.

### 1. `npm install` dies with `EROFS … /home/gabriel/.npm/_cacache`

```
npm error code EROFS
npm error syscall mkdtemp
npm error path /home/gabriel/.npm/_cacache/tmp/njR0Pm
npm error rofs EROFS: read-only file system
npm error Log files were not written due to an error writing to the directory: /home/gabriel/.npm/_logs
```

The environment exports `npm_config_cache=/home/gabriel/.npm`, and that path is read-only. An
environment variable **beats** the repo's own `.npmrc` (which already pins `cache=.npm-cache`), so
the local cache setting is silently overridden.

**Fix** — point the cache at a writable directory inside the project:

```bash
export npm_config_cache="$PWD/.npm-cache"
npm install
# or, without exporting:
npm install --cache "$PWD/.npm-cache"
```

The export is per-shell: repeat it in any new terminal, or add it to your shell profile.
`.npm-cache/` is already in `.gitignore`.

### 2. `node scripts/fetch-sprites.mjs` stalls part-way through the 493 sprites

`raw.githubusercontent.com` serves the first few hundred sprites and then starts throttling. It
does **not** return an error — the connection simply hangs until the per-request timeout expires,
so a run that looks stuck usually is.

**That is why jsDelivr is the primary source**, not GitHub's raw host:

| Order | Source | URL |
| --- | --- | --- |
| 1 | `jsdelivr` (primary) | `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/<dex>.png` |
| 2 | `raw` (fallback) | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/<dex>.png` |
| 3 | `api` (last resort) | GitHub Contents API — same blob, base64; capped at 60 requests/hour unauthenticated |

```bash
node scripts/fetch-sprites.mjs                       # dex 1..493, auto source order
node scripts/fetch-sprites.mjs 1 151                 # explicit range
node scripts/fetch-sprites.mjs --source=jsdelivr     # force a source: jsdelivr | raw | api | auto
node scripts/fetch-sprites.mjs --concurrency=3 --delay=120 --timeout=8000
```

The script is **idempotent and resumable**: a sprite that exists and is non-empty is skipped, bytes
are written to a `.tmp` file and renamed, and each failure is retried twice with backoff. If a run
still fails, simply re-run it later — it picks up where it stopped. It exits non-zero if sprites are
still missing. Nothing in the JSON pipeline depends on the sprites: the UI degrades to a
Pokédex-styled monogram when one is absent.

## Project layout

```
.
├── .cache/
│   └── pokeapi/             Vanilla Platinum baseline (git-ignored, ~137 MB)
│       ├── <dex>.json       493 verbatim PokeAPI /pokemon/<dex> responses
│       ├── item-tm41.json   …100 verbatim /item/tm01…hm08 responses
│       ├── machine-890.json …100 verbatim /machine/<id> responses
│       ├── move-<slug>.json …465 verbatim /move/<slug> responses (English names)
│       ├── form-<slug>.json …26 verbatim /pokemon-form/<slug> responses (form names + types)
│       ├── derived.json     ~561 KB projection of all of the above — the only file build-data.mjs reads
│       └── manifest.json    cache version, source, fetchedAt, counts
├── data/
│   └── source/              14 original .txt documents + typechart_new.png (verbatim, CRLF, never edited)
├── docs/
│   ├── DATA-SCHEMA.md       How each source document maps to JSON, plus the parsing rules
│   └── PARSE-REPORT.md      The pipeline's own audit: counts, unparsed lines, source quirks
├── public/
│   ├── data/                13 generated JSON files (deliberately not gitignored: the site deploys as-is)
│   └── sprites/             493 PokeAPI sprites, named <dex>.png
├── scripts/
│   ├── build-data.mjs       Pipeline entry point: reads data/source/ + the baseline cache, writes public/data/
│   ├── fetch-baseline.mjs   Vanilla Platinum baseline fetcher (PokeAPI → .cache/pokeapi/, network)
│   ├── fetch-sprites.mjs    Sprite downloader (jsDelivr → raw → GitHub API)
│   ├── contract-check.ts    tsc-level proof that every JSON file satisfies the frozen contract
│   └── lib/                 One parser per document + shared text primitives
│       ├── baseline.mjs     PokeAPI cache, the Platinum projection and the TM/HM slot table
│       ├── enrich.mjs       Merges the baseline into the parsed documents (documented values win)
│       └── …                text.mjs, pokemon.mjs, types.mjs, moves.mjs, items.mjs, …
├── src/
│   ├── views/               One component per route (PokemonList, TypesView, TrainersView, …)
│   ├── components/          layout/, pokemon/ and reusable ui/ primitives
│   ├── lib/                 Data loading, search (Fuse.js), route table, English label maps
│   └── types/data.ts        THE frozen data contract
├── tools/
│   ├── audit.mjs            Independent verification harness (re-derives counts from the source)
│   └── browser.mjs          Chrome DevTools Protocol driver for interactive checks of the site
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Data pipeline

`npm run data` runs `scripts/build-data.mjs`, which reads `data/source/` **plus the vanilla
Platinum baseline cached in `.cache/pokeapi/`**, and writes 13 JSON files to `public/data/`. It has
**no dependencies** (Node 22 ESM built-ins only), works **completely offline** once the baseline is
cached, and is **deterministic**: stable key and array order, plus a `generatedAt` stamp derived
from the newest source file's mtime, so two consecutive runs produce byte-identical output.

| Module | Source document | Parses |
| --- | --- | --- |
| `scripts/lib/text.mjs` | — | Shared primitives: CRLF stripping, whitespace collapsing, `NNN - Name` entry anchoring, stat blocks, Old/New pairs, tab/space column splitting, rule-based section splitting |
| `scripts/lib/pokemon.mjs` | `PokemonChanges.txt`, `SinnohanForms.txt` | Entry headers, type/stat/ability Old-New pairs, held items, happiness, gender ratios, learnsets (level-up / TM / tutor), form variants, unparsed lines → `RawSection` |
| `scripts/lib/types.mjs` | `TypeChanges.txt` | The four `Ice now takes …` chart sentences + rationale paragraphs, and the 69-row type-change table (tab- and space-separated rows alike) |
| `scripts/lib/moves.mjs` | `MoveChanges.txt` | The replacement table, the 10 new-move definition blocks, `Label: from >> to` modifications, and batch headings → **one** `MoveModification` per group with `moves[]`, `changes[]` and `exceptions[]` for `Label(Move):` lines that concern a single member (`groupModifications` + `groupNotes` for the section's own prose) |
| `scripts/lib/items.mjs` | `ItemChanges.txt` | Cost bullets (`$200 >> $50`), usable items, TM changes, mart and Dept. Store stock, item/TM/plate location tables, replaced items |
| `scripts/lib/evolutions.mjs` | `EvolutionChanges.txt` | Bullet lists split into `{ pokemon, text }` per section |
| `scripts/lib/trainers.mjs` | `TrainerPokemon.txt` | 87 areas, 774 trainer lines (markers `* ! (3) (C) (S)`, `(S)` species), rematches, 72 detailed boss sets with items/abilities/moves |
| `scripts/lib/wild.mjs` | `WildPokemon.txt` | 96 areas, 501 methods, 2 469 encounter slots, level strings kept verbatim |
| `scripts/lib/events.mjs` | `SpecialEvents.txt` | Gift / static / legendary sections with `Location:` and `Level:` fields |
| `scripts/lib/misc.mjs` | `NPCChanges.txt`, `TradeChanges.txt`, `LevelCaps.txt`, `FrequentlyAskedQuestions.txt`, `ActionReplayCodes.txt` | NPC sections, the 4 trades (request, item, IVs, nature), level caps, FAQ with nested sub-sections, opaque Action Replay codes |
| `scripts/lib/baseline.mjs` | `.cache/pokeapi/` (PokeAPI) | Loads the cached Platinum baseline, projects it, and rebuilds the vanilla `TM/HM slot → move` table from the 100 cached item/machine responses |
| `scripts/lib/enrich.mjs` | parsed documents + baseline | Parses the `Moves:` compatibility lines into `learnset.tm` / `learnset.tutor`, fills the gaps from the baseline, and returns the `meta.enrichment` counters |
| `scripts/lib/search.mjs` | all of the above | The 1 405-record search index (one record per Pokémon, item, move, area, form, event, …) |

### Re-running after editing a source document

```bash
# 1. edit data/source/<Document>.txt   (keep it verbatim; never "fix" the source in place)
npm run data                            # regenerates all 13 files in public/data/
node tools/audit.mjs                    # re-derives counts from the source and compares
npm run check:contract                  # type-checks the output against src/types/data.ts
```

Then reload the browser page: the app fetches `public/data/*.json` at runtime and caches each file
per session, so a reload is enough — no dev-server restart.

The build prints, every run, the output files and their sizes, every assertion, the parsed content
counts, all warnings (e.g. a source BST that disagrees with its own six stats), all relocated
content notes, and the full unparsed-line report. A failing assertion makes the build `exit(1)`.
If a JSON file is missing, the UI keeps working on typed fixtures and shows a discreet banner
pointing at `public/data/<file>`.

If you add or change a *field*, update `src/types/data.ts` and `docs/DATA-SCHEMA.md` in the same
commit — see below.

## Vanilla Platinum baseline enrichment

The documents record **changes only**. `PokemonChanges.txt` says so itself:

> - TM compatibilty with any of the new TMs (Bug Buzz, Hurricane) is also listed here.

It lists the compatibilities that *changed* and never enumerates a species' full TM/HM or
move-tutor list; only **231 of the 493** entries document a `New` stat block, and the other **262
carry no stats at all**. Left alone, that leaves **262 entries with no stats** and no complete
TM/HM or move-tutor list for any of the 493 base species — the documents state only the
compatibilities that changed.

So a second stage completes them from a **vanilla Platinum baseline**: `npm run baseline` caches
one, and `scripts/lib/enrich.mjs` merges it into the parsed documents during `npm run data`.

### The merge rule

**Documented values always win. The baseline only ever fills a gap, and every value it contributes
is labelled as coming from it.**

| Field | Filled when | Provenance flag |
| --- | --- | --- |
| `PokemonChange.baseStats` | the entry documents no `New` stat block | `baseStatsSource: "baseline"` (documented values get `"documented"`) |
| `learnset.tm` | baseline list first, then the `Moves:` compatibility lines the documents state (merged in, those flagged `isNew: true`) | `learnset.includesBaseline: true` |
| `learnset.tutor` | same | `learnset.includesBaseline: true` |
| `learnset.levelUp` | the entry documents no level-up list at all | `learnset.includesBaseline: true` |
| `SinnohanForm.replacedTypes` / `replacedStats` | always — the vanilla species and stats the regional form replaces | fields always present (65/65) |

Where a document and the baseline disagree about the same slot, the document wins and the build
prints a warning naming both values. Nothing is ever overwritten silently.

`meta.json` → `enrichment` records what the last build filled, and where and when the cache came
from (`fetchedAt` is read from `.cache/pokeapi/manifest.json`):

```json
{
  "source": "PokeAPI (version group: platinum)",
  "url": "https://pokeapi.co/api/v2/pokemon/{dex}",
  "fetchedAt": "2026-10-03T15:00:35.894Z",
  "statsFilled": 262,
  "tmFilled": 476,
  "tutorFilled": 487,
  "levelUpFilled": 65
}
```

### Where it is stored

| Path | What it holds | Size / count | In git |
| --- | --- | --- | --- |
| `.cache/pokeapi/` | Raw, **verbatim** PokeAPI responses | 1 186 files, 137 MB | No — `.cache/` is git-ignored |
| `.cache/pokeapi/<dex>.json` | `/pokemon/<dex>`, dex 1–493 | 493 files | No |
| `.cache/pokeapi/item-tm41.json` | `/item/tm01` … `/item/hm08` (the vanilla TM/HM slots) | 100 files | No |
| `.cache/pokeapi/machine-890.json` | `/machine/<id>` — which move a machine teaches | 100 files | No |
| `.cache/pokeapi/move-<slug>.json` | `/move/<slug>` — the English move names | 465 files | No |
| `.cache/pokeapi/form-<slug>.json` | `/pokemon-form/<slug>` — the 26 alternate forms the documents leave implicit (Rotom, Deoxys, Castform, …) | 26 files | No |
| `.cache/pokeapi/derived.json` | Small projection of everything above — **the only baseline file `build-data.mjs` reads** | 561 KB | No |
| `.cache/pokeapi/manifest.json` | Cache version, source, `fetchedAt`, counts | 1 small file | No |
| `public/data/pokemon.json` | Merged result: `baseStats`, `baseStatsSource`, `learnset.tm`, `learnset.tutor`, `learnset.levelUp`, `learnset.includesBaseline` | 493 entries, 1.61 MB | Yes |
| `public/data/sinnohan.json` | Merged result: `replacedTypes`, `replacedStats`, `learnset.includesBaseline` | 65 entries, 253 KB | Yes |
| `public/data/meta.json` → `enrichment` | Source, URL, `fetchedAt` and the four fill counters | — | Yes |
| `scripts/fetch-baseline.mjs` | The fetcher: PokeAPI → raw cache → `derived.json` + `manifest.json` | — | Yes |
| `scripts/lib/baseline.mjs` | Cache layout, the Platinum projection, the TM/HM slot table, and the loader `build-data.mjs` calls | — | Yes |
| `scripts/lib/enrich.mjs` | The merge rules above, and the `meta.enrichment` counters | — | Yes |

The raw responses stay on disk on purpose: they are the evidence, and re-projecting them needs no
network. `build-data.mjs` never fetches anything.

### Why PokeAPI and not Poképedia

**The baseline does not come from Poképedia — it comes from PokeAPI**, filtered to the `platinum`
version group:

- endpoint: `https://pokeapi.co/api/v2/pokemon/<dex>` (this exact template is recorded in
  `meta.enrichment.url`);
- filter: only `moves[].version_group_details[]` entries whose
  `version_group.name === "platinum"` are read, with `move_learn_method.name` selecting
  `level-up` / `machine` / `tutor`. That is what makes the lists Platinum-scoped rather than
  Scarlet-and-Violet-scoped.

Two practical reasons, both checkable in this repository:

| | PokeAPI (used) | Poképedia (not used) |
| --- | --- | --- |
| Shape | Structured JSON: `stats[]`, `moves[].version_group_details[]` — no HTML parsing, no heuristics | Rendered wiki HTML: a `Par CT` section that bundles **several generations' TM tables into one page** |
| Platinum scoping | Explicit: the version group *is* the filter | None on the species page — the fetched copy of the Charizard page mentions `Platine` exactly **0** times and lists no Gen-IV table at all |
| Language | English move names from `move.names[language=en]` | French names (`Dracaufeu`, `Déflagration`), so every value would need a name mapping |
| Offline use | Cache once, then re-project and rebuild byte-identically with no network | Live scraping on every refresh |

The Poképedia page was inspected once during the investigation to settle the question (`Dracaufeu`,
964 KB of HTML) and was **not** kept — it was a throwaway download, not part of the pipeline, so no
such file exists in the tree. What that inspection established is recorded here: the page's `Par CT`
section holds only Gen VIII (Épée/Bouclier, Diamant Étincelant/Perle Scintillante) and Gen IX
(Écarlate/Violet, Légendes Pokémon : Z-A) tables — there is no Platinum TM list on the page to
extract in the first place.

### Coverage after enrichment

Straight from the build's `PARSED CONTENT` block and `meta.enrichment`:

| | Coverage | Where it comes from |
| --- | --- | --- |
| Base stats | **493 / 493** | 231 documented + 262 baseline |
| TM / HM lists | **477 / 493** | 476 from the baseline + Combee, whose `TM62 Bug Buzz` the documents state; 16 legitimately empty |
| Move-tutor lists | **487 / 493** | all from the baseline; 6 legitimately empty |
| Level-up lists | **493 / 493** | 65 of them exist only because of the baseline |
| Sinnohan `replacedTypes` / `replacedStats` | **65 / 65** | always taken from the vanilla species |

The build asserts all of this itself (e.g. *every `PokemonChange` has `baseStats` — 493/493*,
*`baseStatsSource` is `documented` or `baseline`*, *`includesBaseline` set whenever baseline lists
were merged*, *no learnset repeats a TM number*), so a regression fails `npm run data`.

### Refreshing the baseline

```bash
npm run baseline                              # fetch what is missing (network needed)
npm run baseline -- --offline                 # re-project derived.json from the raw cache, no network
npm run baseline -- --force                   # re-fetch every response
node scripts/fetch-baseline.mjs               # the same thing without npm
npm run data                                  # rebuild public/data/ — offline, deterministic
```

The first run needs network and takes a minute or two (493 Pokémon + 100 items + 100 machines +
465 moves, 6 requests at a time, 2 retries each). After that everything is offline: the fetcher
re-projects `derived.json` byte-identically, and `build-data.mjs` reads only `derived.json`.

**A cold cache fails loudly, on purpose:**

```console
$ node scripts/build-data.mjs
BUILD FAILED — vanilla Platinum baseline is not cached: .cache/pokeapi is missing.
  Run `node scripts/fetch-baseline.mjs` once (it needs network) — after that
  both the fetcher and `node scripts/build-data.mjs` work completely offline.
$ echo $?
1
```

That is deliberate: the data contract requires every entry to carry `baseStats`, so building
without the baseline cannot produce a valid dataset. `npm run build` runs `npm run data` and does
**not** run `npm run baseline`, so a fresh clone needs the baseline fetched once before its first
production build.

### Honest caveats

These are the places where the baseline is right about *its* source and may still be wrong about
*this hack*. Read them before trusting a filled list.

1. **The hack's TM compatibility matches Ultra Sun / Ultra Moon, not Platinum.** `ItemChanges.txt`
   states it verbatim: *"The following TMs have had their moves changed (compatibility matches
   Ultra Sun and Ultra Moon plus extras as listed in Pokémon Changes)"*. The baseline is vanilla
   **Platinum** — Gen IV, 2008. Wherever a document states a compatibility it wins, so the
   documented additions are correct (Charizard's `TM88 Hurricane` and tutor `Draco Meteor` are both
   there, `isNew: true`), but a **baseline-filled TM list can differ from the hack's real list**,
   and the hack publishes no 493-row USUM table to check it against. This is not resolvable from
   the sources available here.
2. **The same applies to the 262 baseline-filled stat blocks.** The `PokemonChanges.txt` general
   notes say *"All Pokémon have had their base stats updated to match Ultra Sun and Ultra Moon"*,
   and only 231 entries spell out a `New` block. The other 262 therefore show vanilla **Platinum**
   stats (`baseStatsSource: "baseline"`), which is the best machine-readable source there is, but
   not necessarily the value the hack ships. The flag is there so the UI and the reader can tell
   the two apart.
3. **TM numbers had to be rebuilt, and the rebuild was cross-checked.** PokeAPI no longer exposes
   the machine id in `version_group_details`, and `/move/<slug>` carries no TM number either, so
   the slot table was derived from the `/item/tm01` … `/item/hm08` resources (each lists its
   `machines[]` per version group). Diffing that derived table against the hack's own table in
   `ItemChanges.txt`: the 100 slots agree **exactly except the 9 the document declares modified** —
   TM41 Hydro Pump, TM47 Iron Head, TM55 Scald, TM57 Wild Charge, TM62 Bug Buzz, TM72 Icicle Crash,
   TM83 Hyper Voice, TM85 Dazzling Gleam, TM88 Hurricane (the baseline correctly holds Torment,
   Steel Wing, Brine, Charge Beam, Silver Wind, Avalanche, Natural Gift, Dream Eater and Pluck).
   That is independent confirmation, not a proof of correctness.
4. **17 species have no vanilla TM/HM list, 6 have no tutor list** — so their lists legitimately
   stay empty:
   - no TM/HM: Caterpie, Metapod, Weedle, Kakuna, Magikarp, Ditto, Unown, Wobbuffet, Smeargle,
     Wurmple, Silcoon, Cascoon, Wynaut, Beldum, Kricketot, Burmy, Combee;
   - no move tutor: Weedle, Ditto, Unown, Wobbuffet, Smeargle, Wynaut.

   Sixteen of the 17 end up with an empty `learnset.tm`; the seventeenth, **Combee**, is the one
   exception, because the documents grant it `TM62 Bug Buzz`. All six of the second group end up
   with an empty `learnset.tutor`. The four Sinnohan forms of dex 10/11/13/14 stay empty for the
   same reason — their vanilla species has no TM list either.
5. **`replacedTypes` is Gen-IV typing, not today's.** PokeAPI's `types[]` is the *current* typing,
   so Fairy-era retcons would leak straight in (Togetic reads `Fairy / Flying` today). The pipeline
   instead reads the pre-Gen-VI typing out of `past_types[]` — the entry with the smallest
   generation ≥ 4 — so Sinnohan Togetic is `Normal / Flying`. This matters for every species that
   was retyped when Fairy was introduced.
6. **`tools/audit.mjs` does not audit the enrichment.** It deliberately re-derives its expectations
   from `data/source/*.txt` only, so it checks what the documents say and says nothing about the
   baseline. The enrichment is guarded by the build's own assertions (listed above) plus the
   independent TM-slot diff in point 3.

## Data contract

`src/types/data.ts` is **frozen**. It is the single source of truth for every shape the pipeline
emits and the UI consumes, and neither side may invent fields outside it. `docs/DATA-SCHEMA.md` is
the human-readable rulebook: how each document maps to JSON, the parsing rules, and the counts the
build must assert.

The contract can be checked at the type level:

```bash
npm run check:contract          # the packaged form of the command below
node_modules/.bin/tsc --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution bundler --resolveJsonModule --skipLibCheck scripts/contract-check.ts
```

It exits `0` on the current dataset.

### The `RawSection` principle

The source documents are hand-written, tab/space-mixed, fixed-width-ish text: no two sections are
laid out quite the same way. A parser that only keeps what it recognises would quietly lose real
documentation.

So the pipeline follows one rule: **unmatched source text is always retained, never silently
dropped.** Anything that cannot be mapped onto a typed field is kept verbatim in the nearest
`RawSection` (inside the entry's `sections[]`, or a document's `noteSections` / `generalNotes`),
in source order, and is counted in the unparsed-line report the build prints. The current build
reports **17 unparsed lines out of 21 623 non-blank source lines (0.08 %)** — 16 in
`PokemonChanges.txt` and 1 in `SinnohanForms.txt`, every one of them still on the site. That is why
`PokemonChange.sections` and `SinnohanForm.sections` exist at all: they are the guarantee that the
documents survive the round trip.

In the same spirit, `docs/DATA-SCHEMA.md` requires that no `RawSection` end up shorter than its
source section body. The build asserts that coverage (`RawSection coverage >= source body lines`),
and the audit independently asserts that no `RawSection` is empty.

## Verification

`tools/audit.mjs` is an **independent** verification harness. It deliberately shares no logic with
`scripts/build-data.mjs`: it re-derives its expectations straight from `data/source/*.txt` with
blunt counting, then compares them against `public/data/*.json`. Its purpose is to catch the failure
mode a self-checking pipeline cannot — a parser that is internally consistent but wrong about the
source.

```bash
node tools/audit.mjs
# → ALL HARD CHECKS PASSED (1 soft warning)          exit code 0
# → N HARD CHECK(S) FAILED                           exit code 1
```

It **exits non-zero on failure**, so it drops straight into CI.

Its scope is deliberate: it re-derives everything from `data/source/*.txt`, so it says nothing
about the vanilla-Platinum enrichment — that is guarded by the build's own assertions plus the
TM-slot cross-check described in [the caveats](#honest-caveats). The two other checks are
`npm run check:contract` (types) and `node scripts/build-data.mjs` (its assertion block).

### The numbers it asserts

| Quantity | Expected | How the audit re-derives it from the source |
| --- | ---: | --- |
| Pokémon entries | **493** | `NNN - Name` lines that sit directly under a `=====` rule in `PokemonChanges.txt` |
| Sinnohan forms | **65** | The same rule-anchored count in `SinnohanForms.txt` |
| Pokémon type changes | **134** | `#NNN …` table rows in `TypeChanges.txt` |f
| Type-chart changes | **4** | `Ice now takes …` sentences in `TypeChanges.txt` |
| Move replacements | **29** | Pinned at 29 and compared with `moves.json` |
| New moves | **10** | `Description:` blocks in `MoveChanges.txt` |
| Learnset replacements | **19** | `^\d+ - …>>…` lines in `PokemonChanges.txt` + `SinnohanForms.txt`, matched against `LearnEntry.replaces` |

Beyond those counts it independently checks that:

- every line mentioning `compatible` in `PokemonChanges.txt` survives somewhere in `pokemon.json`;
- every `StatBlock` satisfies `bst === hp + atk + def + spa + spd + spe`, with no negative or
  non-numeric values;
- no Pokémon or Sinnohan entry is completely empty, and no `RawSection` is empty;
- Pokémon and Sinnohan dex numbers and slugs are unique;
- hand-verified spot checks still hold: Charizard `Fire/Flying → Fire/Dragon`, Arceus's new BST
  `1000`, Bayleef's `60/62 → 70/42` reshuffle, Sinnohan Butterfree `Bug/Fairy` at `535` BST, dex
  **309** carrying a `Sinnohan` name even though the source header says only `Electrike`;
- the type chart says exactly what the document says: Ice gains resistances to Ground/Water/Dragon
  **and Rock drops from 2× to 1×** (a removed weakness, *not* a resistance);
- the search index is non-trivial (≥ 1 200 records), every record has an id/title/body/badges and a
  `#/…` route, and every Pokémon appears in it;
- `meta.counts.*` agrees with the files it describes, and `meta.documents` covers all 14 sources.

The single **soft** warning (printed with `!`, not counted as a failure) is a deliberate
approximation: `wild.areas` is 96 while `WildPokemon.txt` has 79 `Levels:` lines, because a few
areas legitimately have no `Levels:` line at all — `Turnback Cave` is one, and `Poké Radar  -`
on Route 224 is an explicit "nothing here" placeholder emitted as a method with zero slots.

## Notable source-data quirks

The source documents are hand-written and have real inconsistencies. The pipeline is **tolerant but
never creative**: it handles or preserves each quirk and never silently "corrects" the author.

| Quirk | Detail and handling |
| --- | --- |
| **All 14 files are CRLF** | Strip `\r` first or every `^…$` anchor silently fails — the trailing `\r` is part of the line. Every reader in the pipeline normalises before anything else. See it for yourself: `grep -cE '^=+$' data/source/PokemonChanges.txt` prints **0**, while the same command piped through `tr -d '\r'` prints 1000. (`file` also mis-detects `LevelCaps.txt` as "CSV text", because its final line has no terminator at all.) |
| **`PokemonChanges.txt` has 493 entries, not 497** | Arceus's learnset ends with four *level-100* moves — `100 - Recover`, `100 - Judgment`, `100 - Spacial Rend`, `100 - Shadow Force` — shaped exactly like entry headers, which a naive `grep -cE '^[0-9]{3} - '` counts as 497. Genuine headers are anchored to the surrounding `===================` rules instead. |
| **Field labels are inconsistent** | `Base Stats :` vs `Base Stats:`, `Type :` vs `Type:`, plus `Ability;` and a bare `Ability` with no punctuation (Torkoal, Deoxys) and `Stats: ` with a trailing space. Labels are matched as `^Label\s*:\s*$`. |
| **`SinnohanForms.txt` dex 309/310 lack the prefix** | `309 - Electrike` and `310 - Manectric` are Sinnohan forms but their headers omit `Sinnohan `. The pipeline normalises the prefix in and derives `baseName` from the species. |
| **Two documents disagree about Mars** | `LevelCaps.txt` line 2 says `Mars, Lv. 18`; `TrainerPokemon.txt` says `Mars, Lv. 19` (and its rosters put the first Commander Mars fight at Lv. 17/18 with a Lv. 19 Glameow). **Both are reproduced verbatim** — `misc.levelCaps` carries 18, `trainers.levelCaps` carries 19 — and the build prints a NOTE about the disagreement. Nothing is reconciled. |
| **Ice's Rock weakness becomes 1×, not 0.5×** | `Ice now takes 1x from Rock.` removes the 2× weakness; it does **not** create a resistance. The multiplier is read from the sentence rather than assumed, and the audit asserts `old 2 → new 1`. |
| **Heracross has an orphan marker** | `1 - Headlong Rush (1)` (line 5919) uses a `(1)` where `(!!)` or `(PLA)` is expected. `(1)` occurs exactly once in the entire document and no footnote defines it. The move and level parse correctly; the unknown marker is reported as an unparsed line and the raw text is kept. |
| **Typos and duplicate `Old` labels are preserved** | Volbeat, Illumise, Sharpedo, Wailord, Camerupt and Grumpig repeat `Old` on their *new* stat block; Gulpin says `Vanilla` instead. The build reads the second block as `New`, warns, and leaves both raw lines in `sections[]`. Misspelled ability names (`Technican`, `Intimdate`) are never corrected. |
| **25 source BSTs disagree with their own six stats** | e.g. Sinnohan Dratini lists `300` but `50+50+40+65+45+55 = 305`. `bst` is recomputed from the six stats (what the game actually uses), a warning prints both numbers, and the original line stays in `sections[]`. Full list in `docs/PARSE-REPORT.md` §5. |
| **`Catch Rate` sub-blocks have no field** | Unown, Beldum, Metang and Metagross hold `Catch Rate` / `Old 225` / `New 255` blocks with no typed slot; they are kept as `RawSection` lines. |
| **`Effect(Hurricane)` is scoped, not group-wide** | The batch heading `Fire Blast/Thunder/Blizzard/Hydro Pump/Focus Blast/Hurricane` carries `Effect(Hurricane): Confusion (30%) >> No Effect (Engine limitation)`: the Power/Accuracy/PP changes apply to all six moves, but the effect applies to **Hurricane alone**. Attributing it to the other five would be a mis-attribution, so `Label(Move):` lines become `exceptions: [{ moves: ["Hurricane"], … }]` on the record instead of a group-wide `changes[]` entry. `Effect(Poison Fang)` under `Elemental Fangs(plus Poison Fang)` is the second instance; the build asserts the Fire Blast group is `6 moves / 3 changes / 1 Hurricane exception` and that every exception targets a move of its own record. **`docs/PARSE-REPORT.md` §6 still describes the superseded behaviour** ("qualifiers are kept verbatim in `label`") and its `113 modifications` figure predates `groupModifications`. |
| **Group preambles stay prose, never records** | `Batch changes made to multiple similar moves.` is kept in `groupNotes`, and the `Move Modifications` preamble sentence in `noteSections`. All 9 `groupModifications` records carry a non-empty `changes[]`, so no renderer ever meets a modification with nothing to show. |
| **A `Moves:` line sits inside Donphan's stat block** | `Now compatible with TM47, Iron Head. (!!)` appears under `232 - Donphan` → `Base Stats` instead of a `Moves:` section. It is not lost: it is parsed into `learnset.tm` like any other compatibility line **and** stays verbatim in that entry's `sections[]`. It is no longer counted as an unparsed line, which is why the total fell from 18 to 17. |
| **`Changelog.txt` is not in `data/source/`** | `changelog.json` is still emitted as `[]` (the contract requires every file to exist), but `#/guides/changelog` currently has no document to render. |

## Language policy of the UI

**The policy is: everything the UI shows is English — chrome *and* game data.**

- Chrome, navigation, route labels, headings, buttons, filters, badges, empty states and error
  messages are English, in `src/lib/routes.ts`, `src/lib/labels.ts` and `src/views/**`.
- The document root is declared English and must stay that way: `<html lang="en">` in `index.html`,
  with `document.documentElement.lang` in `src/main.tsx` agreeing.
- Every species, move, ability, item, area, trainer and NPC name is rendered **unchanged from the
  documents**: `Sinnohan Butterfree`, `Tackle`, `Never-Melt Ice`, `Route 204 ~ South`,
  `Battle Marathon Only`. This is what the game and the documentation use, and translating it would
  make the site harder to use with the game in hand — it would also break the round-trip guarantee
  between the JSON and `data/source/`.
- Game data therefore stays English *because it is English in the sources*: nothing in
  `public/data/` is translated, and no label is invented for a value that came out of a document.
- The time-of-day encounter methods (`Morning` / `Day` / `Night`) are **not** translated either —
  they come from `WildPokemon.txt` and are displayed verbatim.

**Status: this is a change of policy, and the code is still catching up.** Until recently the chrome
was French, and French strings remain in `src/lib/routes.ts` (`Tableau de bord`, `Dresseurs`, …),
`src/lib/labels.ts` and several views, while `src/main.tsx` still sets
`document.documentElement.lang = 'fr'`. Those are **leftovers to be translated, not a style to
imitate**: replace each with its English equivalent, and do not add new ones. The data layer was
never affected, because it has always copied the documents verbatim.

**Please do not "fix" anything on the data side.** UI strings belong in the label maps, in English,
spelled the same as the source document wherever one exists; a value that came from a source
document is displayed verbatim.

## Credits and licensing

- **The ROM hack and all of its documentation are the work of Drayano**, building on the original
  *Pokémon Platinum* hack lineage. This project only *presents* that documentation — it contains no
  game code, no ROM data and no patch.
- The three source PDFs and the plain-text files in `data/source/` are Drayano's documents,
  reproduced verbatim. **Confirm the documentation's own license terms before redistributing it**
  anywhere else — this repository's license does not extend to the author's text.
- **The hack's custom sprites are not redistributable and are deliberately not included.** The site
  therefore uses [PokeAPI/sprites](https://github.com/PokeAPI/sprites) sprites of the **original**
  species, and always renders Sinnohan forms with a visible **`S`** badge
  (`src/components/ui/Sprite.tsx`) so a Sinnohan form is never mistaken for the vanilla species.
- Sprites come from [PokeAPI/sprites](https://github.com/PokeAPI/sprites), fetched by
  `scripts/fetch-sprites.mjs`.
- **Pokémon is a trademark of Nintendo / Creatures Inc. / GAME FREAK inc.** This is an unofficial,
  non-commercial fan project and is not affiliated with, endorsed by, or sponsored by them.
