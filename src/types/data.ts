/**
 * FROZEN DATA CONTRACT — Pokemon Altered Platinum Codex
 * ------------------------------------------------------
 * These types describe the JSON files emitted by `scripts/build-data.mjs`
 * into `public/data/` and consumed by the React app.
 *
 * The data pipeline MUST produce JSON that satisfies these types exactly.
 * The UI MUST NOT depend on fields outside this contract.
 *
 * Every collected document section that does not map to a typed field is
 * preserved verbatim in a `RawSection` so that no source information is lost.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type PType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Electric'
  | 'Grass'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Bug'
  | 'Rock'
  | 'Ghost'
  | 'Dragon'
  | 'Dark'
  | 'Steel'
  | 'Fairy'
  | '???'

/** A section of a source document kept verbatim (title + body lines). */
export interface RawSection {
  /** e.g. "General Changes", "Ability", "Item Interaction Changes" */
  title: string
  /** Body lines with surrounding whitespace trimmed; blank lines removed. */
  lines: string[]
}

/** Section in a document that is a bullet list under a heading. */
export interface NoteSection extends RawSection {
  title: string
  lines: string[]
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export interface StatBlock {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
  bst: number
}

export interface StatChange {
  old: StatBlock
  new: StatBlock
}

/* ------------------------------------------------------------------ */
/* Moves / learnsets                                                   */
/* ------------------------------------------------------------------ */

/** `isNew` = source marked the move with `(!!)` (previously unavailable). */
export interface LearnEntry {
  level: number
  /** The move now learned at this level. */
  move: string
  isNew: boolean
  /** `PLA` when the source marked the move with `(PLA)`. */
  source?: 'PLA'
  /**
   * Set when the source writes `LEVEL - OldMove >> NewMove`, meaning the learnset
   * slot was re-pointed: `move` holds `NewMove` and this holds `OldMove`.
   * Occurs on Wormadam's cloak learnsets.
   */
  replaces?: string
}

export interface TMLearn {
  /** e.g. "06", "HM01" */
  num: string
  move: string
  /** True when the hack's documentation newly added this compatibility (`(!!)`). */
  isNew?: boolean
}

/** A move-tutor compatibility. Was a bare `string` before the tutor list became a list. */
export interface TutorLearn {
  move: string
  /** True when the hack's documentation newly added this tutor move (`(!!)`). */
  isNew?: boolean
}

export interface Learnset {
  levelUp: LearnEntry[]
  tm: TMLearn[]
  tutor: TutorLearn[]
  /**
   * True when this learnset was completed from the **vanilla Platinum** baseline
   * (PokeAPI `version_group: platinum`) because the hack's documents only record
   * changes and never enumerate the full list. The UI must say so rather than
   * presenting baseline entries as hack-documented ones.
   */
  includesBaseline?: boolean
}

/** A note line from a `Moves:` section. */
export interface MoveNote {
  text: string
  isNew: boolean
  source?: 'PLA'
}

/* ------------------------------------------------------------------ */
/* Form variants (Rotom, Shaymin, Deoxys, Wormadam, ...)               */
/* ------------------------------------------------------------------ */

export interface FormVariant {
  /** e.g. "Sky Forme", "Plant Cloak", "All Evolutions", "Fan Rotom" */
  form: string
  ability?: { old: string[]; new: string[] }
  stats?: StatChange
  moves?: MoveNote[]
  levelUp?: LearnEntry[]
  /**
   * The form's own types.
   *
   * Rotom's five alternate forms take their Gen-V secondary types
   * (`TypeChanges.txt`: "Rotom's five alternate forms take the secondary type
   * that they have in the Gen V games"), which the documents state as a rule
   * rather than per form. Resolved from the vanilla baseline so the UI can list
   * Heat/Wash/Frost/Fan/Mow with their real typing.
   */
  types?: string[]
}

/* ------------------------------------------------------------------ */
/* Pokemon Changes (PokemonChanges.txt)                                */
/* ------------------------------------------------------------------ */

export type ChangeKind =
  | 'type'
  | 'stats'
  | 'ability'
  | 'moves'
  | 'learnset'
  | 'evolution'
  | 'item'
  /** Regional variant (Sinnohan form). Rendered as "Regional form", never as "Other". */
  | 'form'
  | 'other'

export interface PokemonChange {
  /** National dex number, e.g. 6 */
  dex: number
  /** Display name without the dex number, e.g. "Charizard" */
  name: string
  /** Lowercase, URL-safe key, e.g. "charizard" */
  slug: string
  /** True when this entry is a Sinnohan form (name contains "Sinnohan" or "(S)"). */
  isSinnohan: boolean
  /** Which kinds of change this entry documents. Never empty. */
  changeKinds: ChangeKind[]
  /** Present only when the source lists a Type `Old`/`New` pair. */
  type?: { old: string[]; new: string[] }
  /**
   * The Pokémon's **vanilla** (unmodified) types.
   *
   * Always present after enrichment, so every entry — including legendaries the
   * documents never re-type, and Sinnohan forms — has a type to display. When
   * `type` is absent the Pokémon keeps these types in Altered Platinum.
   */
  baseTypes?: string[]
  /** Where `baseTypes` came from. */
  baseTypesSource?: 'baseline'
  /** Present only when the source lists a `Base Stats` `Old`/`New` pair. */
  stats?: StatChange
  /**
   * The Pokémon's **effective** base stats in Altered Platinum.
   * Equals `stats.new` when a change is documented; filled from the vanilla
   * Platinum baseline otherwise so every entry has a stat spread to display.
   */
  baseStats?: StatBlock
  /** Where `baseStats` came from — `baseline` means the documents record no stat change. */
  baseStatsSource?: 'documented' | 'baseline'
  /** Present only when the source lists an `Ability` `Old`/`New` pair. */
  ability?: { old: string[]; new: string[] }
  /** Lines from the entry's `Moves:` section. */
  moves: MoveNote[]
  learnset: Learnset
  /** Bullet lines from the entry's `Evolution:` section. */
  evolution: string[]
  heldItem?: string
  baseHappiness?: string
  genderRatio?: string
  forms: FormVariant[]
  /** Every section of the entry, verbatim, in source order. */
  sections: RawSection[]
}

/* ------------------------------------------------------------------ */
/* Sinnohan Forms (SinnohanForms.txt)                                  */
/* ------------------------------------------------------------------ */

export interface SinnohanForm {
  dex: number
  /** e.g. "Sinnohan Butterfree"; "Sinnohan " prefix normalised in. */
  name: string
  /** e.g. "Butterfree" */
  baseName: string
  slug: string
  /** The form's types in Altered Platinum. */
  types: string[]
  /**
   * The types of the species this form replaces, in vanilla Platinum.
   * Lets the UI render the type change (`Dark` -> `Dark / Steel`) instead of
   * showing only the final typing.
   */
  replacedTypes?: string[]
  /** Vanilla Platinum base stats of the replaced species, for the stat comparison. */
  replacedStats?: StatBlock
  /** Split from `Ability:` on "/". */
  abilities: string[]
  stats: StatBlock
  /** Bullet lines from the `Evolution:` section (usually one line). */
  evolution: string[]
  learnset: Learnset
  /** Every section of the entry, verbatim, in source order. */
  sections: RawSection[]
}

/* ------------------------------------------------------------------ */
/* Type changes (TypeChanges.txt)                                      */
/* ------------------------------------------------------------------ */

/** A single cell change on the type chart. */
export interface TypeChartChange {
  /** Attacking type, e.g. "Ground" */
  attacker: string
  /** Defending type, e.g. "Ice" */
  defender: string
  /** Multiplier in vanilla Platinum (1, 0.5, 2, 0). */
  oldMultiplier: number
  /** Multiplier in Altered Platinum. */
  newMultiplier: number
  /** Free-text rationale following the change, if any. */
  note?: string
}

export interface TypeChangeEntry {
  dex: number
  name: string
  oldTypes: string[]
  newTypes: string[]
  justification: string
}

export interface TypeChangesDoc {
  generalNotes: string[]
  iceTypeNotes: string[]
  chartChanges: TypeChartChange[]
  pokemonChanges: TypeChangeEntry[]
  /** Rationale paragraphs keyed by the type they justify, e.g. "Ground". */
  rationales: { type: string; text: string }[]
}

/* ------------------------------------------------------------------ */
/* Moves, items, evolutions                                            */
/* ------------------------------------------------------------------ */

export interface MoveReplacement {
  oldMove: string
  newMove: string
  /** True when `newMove` is a brand-new move introduced by the hack. */
  isNew: boolean
}

/** A named block such as a new move's full definition. */
export interface NewMove {
  name: string
  type?: string
  /** e.g. "Special, Opponent's side of field" */
  class?: string
  power?: number
  pp?: number
  accuracy?: number
  effect?: string
  description?: string
}

export interface MoveFieldChange {
  label: string
  from: string
  to: string
}

/**
 * A change that applies to only *some* of a grouped modification's moves.
 *
 * The source writes `Effect(Hurricane): Confusion (30%) >> No Effect` under a
 * line naming six moves — that effect belongs to Hurricane alone. Modelling it
 * as a normal `MoveFieldChange` would wrongly attribute it to all six.
 */
export interface MoveFieldException extends MoveFieldChange {
  /** The subset of `MoveModification.moves` this change actually applies to. */
  moves: string[]
}

/**
 * One block of numeric move changes.
 *
 * `moves` holds every move the block covers: exactly one for a plain
 * modification, several for a grouped ("batch") one. `changes` apply to all of
 * them; `exceptions` apply only to their own `moves` subset.
 */
export interface MoveModification {
  /** Display label: the move name, or a joined summary for a group. */
  label: string
  moves: string[]
  changes: MoveFieldChange[]
  exceptions: MoveFieldException[]
}

export interface MovesDoc {
  generalNotes: string[]
  replacements: MoveReplacement[]
  newMoves: NewMove[]
  /** Single-move changes from the "Move Modifications" section. */
  modifications: MoveModification[]
  /** Grouped changes from the "Move Group Modifications" section. */
  groupModifications: MoveModification[]
  /** Prose introducing the group section, e.g. "Batch changes made to multiple similar moves." */
  groupNotes: string[]
  /** Any extra bullet-only sections that are not one of the above. */
  noteSections: NoteSection[]
}

/** A bullet list section like "- Poké Ball     ($200 >> $50)". */
export interface CostChange {
  item: string
  oldPrice: number | null
  newPrice: number | null
  /** Set when the source uses a non-numeric arrow (e.g. "N/A >> $9800"). */
  raw: string
}

export interface ReplacedItem {
  oldItem: string
  newItem: string
  note?: string
}

export interface ItemLocationRow {
  item: string
  locations: string
}

export interface TMLocationRow {
  tm: string
  move: string
  location: string
  obtained: string
  changed: boolean
}

export interface ItemsDoc {
  generalNotes: string[]
  /** Items that gained a "Use" option. */
  usableItems: string[]
  costChanges: CostChange[]
  tmChanges: { tm: string; move: string }[]
  martChanges: string[]
  deptStoreStock: string[]
  itemLocations: ItemLocationRow[]
  tmLocations: TMLocationRow[]
  vitaminReplacements: string[]
  plateLocations: string[]
  replacedItems: ReplacedItem[]
  noteSections: NoteSection[]
}

export interface EvolutionSection extends NoteSection {
  /** Each bullet split into the Pokemon it concerns and the full text. */
  entries: { pokemon: string; text: string }[]
}

export interface EvolutionsDoc {
  sections: EvolutionSection[]
}

/* ------------------------------------------------------------------ */
/* Trainers & wild encounters                                          */
/* ------------------------------------------------------------------ */

export interface TeamSlot {
  species: string
  level: number
  isSinnohan: boolean
}

export interface TrainerEntry {
  name: string
  /** Markers after the name: "!", "*", "(3)", "(C)", "(S)", ... */
  markers: string[]
  team: TeamSlot[]
  /** Post-badge variants declared on the same line, when several share a name. */
  raw: string
}

export interface BossSlot extends TeamSlot {
  item?: string
  ability?: string
  moves: string[]
}

export interface BossDetail {
  name: string
  team: BossSlot[]
}

export interface TrainerArea {
  area: string
  trainers: TrainerEntry[]
  rematches: TrainerEntry[]
  bosses: BossDetail[]
}

export interface TrainersDoc {
  generalNotes: string[]
  levelCaps: string[]
  areas: TrainerArea[]
}

export interface EncounterSlot {
  species: string
  percent: number
  isSinnohan: boolean
}

export interface EncounterMethod {
  /** e.g. "Morning", "Surf", "Berry Lure", "Honey Tree", "Poké Radar" */
  method: string
  slots: EncounterSlot[]
}

export interface WildArea {
  area: string
  /** e.g. "4 - 5 (Walking/Fishing), 20 - 40 (Surfing)" */
  levels: string
  methods: EncounterMethod[]
}

export interface WildDoc {
  generalNotes: string[]
  areas: WildArea[]
}

/* ------------------------------------------------------------------ */
/* Special events, NPC/trade changes, FAQ, misc                       */
/* ------------------------------------------------------------------ */

export interface EventItem {
  /** e.g. "Baby Pokémon Egg Gift" */
  title: string
  location?: string
  level?: string
  lines: string[]
}

export interface EventSection {
  title: string
  items: EventItem[]
}

export interface EventsDoc {
  generalNotes: string[]
  sections: EventSection[]
}

export interface TradeEntry {
  city: string
  /** e.g. "You will be asked for a Ponyta in exchange for a Spheal." */
  request: string
  givenName?: string
  species?: string
  item?: string
  ivs?: string
  nature?: string
  lines: string[]
}

export interface MiscDoc {
  npc: NoteSection[]
  trades: TradeEntry[]
  tradeNotes: string[]
  levelCaps: string[]
  faq: { question: string; answer: string[]; subsections: NoteSection[] }[]
  actionReplay: NoteSection[]
}

export interface ChangelogEntry {
  version: string
  date?: string
  lines: string[]
}

/* ------------------------------------------------------------------ */
/* Meta & search                                                       */
/* ------------------------------------------------------------------ */

export interface DocumentStat {
  /** Stable id, e.g. "pokemon-changes" */
  id: string
  /** Display title, e.g. "Pokémon Changes" */
  title: string
  /** Source filename, e.g. "PokemonChanges.txt" */
  file: string
  /** Whole-document version header when the source declares one. */
  version?: string
  /** Short description of what the document covers. */
  summary: string
  /** Number of parsed top-level entries (0 when not applicable). */
  entryCount: number
  /** The document's leading prose sections, verbatim. */
  generalNotes: NoteSection[]
  /** Route in the app that renders this document. */
  route: string
}

export interface MetaDoc {
  hack: string
  version: string
  originalAuthor: string
  generatedAt: string
  documents: DocumentStat[]
  /**
   * Vanilla-Platinum enrichment. The hack's documents record only *changes*, so
   * base stats, TM/HM and move-tutor lists were completed from the vanilla
   * Platinum baseline. This block records exactly what was filled and from where,
   * so the UI can label it honestly.
   */
  enrichment?: {
    /** Human-readable source name, e.g. "PokeAPI (version group: platinum)". */
    source: string
    url: string
    fetchedAt: string
    /** How many entries gained a `baseStats` block they did not have before. */
    statsFilled: number
    /** How many entries gained TM/HM entries. */
    tmFilled: number
    /** How many entries gained move-tutor entries. */
    tutorFilled: number
    /** How many level-up lists were completed. */
    levelUpFilled: number
  }
  counts: {
    documents: number
    pokemon: number
    pokemonWithTypeChange: number
    pokemonWithStatChange: number
    pokemonWithAbilityChange: number
    sinnohan: number
    typeChangeEntries: number
    typeChartChanges: number
    moveReplacements: number
    newMoves: number
    moveModifications: number
    costChanges: number
    trainerAreas: number
    trainers: number
    wildAreas: number
    events: number
    trades: number
    faq: number
  }
}

export type SearchKind =
  | 'pokemon'
  | 'sinnohan'
  | 'type'
  | 'move'
  | 'item'
  | 'evolution'
  | 'trainer'
  | 'wild'
  | 'event'
  | 'npc'
  | 'trade'
  | 'faq'
  | 'guide'
  | 'doc'

export interface SearchRecord {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  /** Extra searchable text (not displayed). */
  body: string
  /** Hash route to open, e.g. "#/pokemon/charizard" */
  route: string
  /** Small chips shown in the result row, e.g. ["Fire", "Dragon"]. */
  badges: string[]
}
