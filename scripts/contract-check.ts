/**
 * Compile-time verification that every file in `public/data/` satisfies the
 * frozen contract in `src/types/data.ts`.
 *
 * JSON module inference widens string-literal unions to `string`, so the three
 * literal-union fields (`changeKinds`, `kind`, `source`) are narrowed back to
 * their literal types with explicit helpers — everything else is checked
 * structurally by root assignability. The unions themselves are additionally
 * verified at runtime by the build's own assertions.
 */
import type {
  ChangeKind,
  ChangelogEntry,
  EventsDoc,
  EvolutionsDoc,
  ItemsDoc,
  LearnEntry,
  MetaDoc,
  MiscDoc,
  MoveNote,
  MovesDoc,
  PokemonChange,
  SearchKind,
  SearchRecord,
  SinnohanForm,
  TrainersDoc,
  TypeChangesDoc,
  WildDoc,
} from '../src/types/data'

import metaJson from '../public/data/meta.json'
import pokemonJson from '../public/data/pokemon.json'
import sinnohanJson from '../public/data/sinnohan.json'
import typeChangesJson from '../public/data/type-changes.json'
import movesJson from '../public/data/moves.json'
import itemsJson from '../public/data/items.json'
import evolutionsJson from '../public/data/evolutions.json'
import trainersJson from '../public/data/trainers.json'
import wildJson from '../public/data/wild.json'
import eventsJson from '../public/data/events.json'
import miscJson from '../public/data/misc.json'
import changelogJson from '../public/data/changelog.json'
import searchJson from '../public/data/search-index.json'

type RawMoveNote = { text: string; isNew: boolean; source?: string }
type RawLearnEntry = { level: number; move: string; isNew: boolean; source?: string; replaces?: string }

const pla = (source?: string) => (source ? { source: 'PLA' as const } : {})
const asMoveNote = (note: RawMoveNote): MoveNote => ({ text: note.text, isNew: note.isNew, ...pla(note.source) })
const asLearnEntry = (entry: RawLearnEntry): LearnEntry => ({
  level: entry.level,
  move: entry.move,
  isNew: entry.isNew,
  ...pla(entry.source),
  ...(entry.replaces ? { replaces: entry.replaces } : {}),
})

/**
 * rev 2 added a second literal union (`baseStatsSource`). JSON module inference
 * widens it to `string`, so it is narrowed back the same way `changeKinds`,
 * `kind` and `source` are. rev 3 adds `baseTypesSource`, whose only legal value
 * is the literal `'baseline'`.
 */
const asBaseStatsSource = (value?: string): 'documented' | 'baseline' | undefined =>
  value === 'documented' || value === 'baseline' ? value : undefined

const asBaseTypesSource = (value?: string): 'baseline' | undefined =>
  value === 'baseline' ? value : undefined

export const meta: MetaDoc = metaJson
export const pokemon: PokemonChange[] = pokemonJson.map((entry) => ({
  ...entry,
  changeKinds: entry.changeKinds as ChangeKind[],
  baseStatsSource: asBaseStatsSource(entry.baseStatsSource),
  baseTypesSource: asBaseTypesSource(entry.baseTypesSource),
  moves: entry.moves.map(asMoveNote),
  learnset: {
    levelUp: entry.learnset.levelUp.map(asLearnEntry),
    tm: entry.learnset.tm,
    tutor: entry.learnset.tutor,
  },
  forms: entry.forms.map((form) => {
    // `FormVariant` is optional-everything, so the JSON union needs a hint
    // before the two literal-bearing members can be read.
    const variant = form as { moves?: RawMoveNote[]; levelUp?: RawLearnEntry[] }
    return {
      ...form,
      ...(variant.moves ? { moves: variant.moves.map(asMoveNote) } : {}),
      ...(variant.levelUp ? { levelUp: variant.levelUp.map(asLearnEntry) } : {}),
    }
  }),
}))
export const sinnohan: SinnohanForm[] = sinnohanJson.map((form) => ({
  ...form,
  learnset: {
    levelUp: form.learnset.levelUp.map(asLearnEntry),
    tm: form.learnset.tm,
    tutor: form.learnset.tutor,
  },
}))
export const typeChanges: TypeChangesDoc = typeChangesJson
export const moves: MovesDoc = movesJson
export const items: ItemsDoc = itemsJson
export const evolutions: EvolutionsDoc = evolutionsJson
export const trainers: TrainersDoc = trainersJson
export const wild: WildDoc = wildJson
export const events: EventsDoc = eventsJson
export const misc: MiscDoc = miscJson
export const changelog: ChangelogEntry[] = changelogJson
export const search: SearchRecord[] = searchJson.map((record) => ({
  ...record,
  kind: record.kind as SearchKind,
}))
