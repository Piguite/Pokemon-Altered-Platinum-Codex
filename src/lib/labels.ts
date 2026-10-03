import type { ChangeKind } from "../types/data"
import type { BadgeTone } from "../components/ui/Card"

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  form: 'Regional form',
  type: 'Type',
  stats: 'Base stats',
  ability: 'Abilities',
  moves: 'Move compatibility',
  learnset: 'Learnsets',
  evolution: 'Evolution',
  item: 'Held item',
  other: 'Other',
}

export const CHANGE_KIND_SHORT: Record<ChangeKind, string> = {
  form: 'Regional',
  type: 'Type',
  stats: 'Stats',
  ability: 'Abilities',
  moves: 'TM/Tutor',
  learnset: 'Learnset',
  evolution: 'Evolution',
  item: 'Item',
  other: 'Other',
}

export const CHANGE_KIND_TONES: Record<ChangeKind, BadgeTone> = {
  /* A Sinnohan form is a replacement of the species, not a tweak: it gets its
     own violet tone (`--color-form`), distinct from every other change kind. */
  form: 'form',
  type: 'info',
  stats: 'good',
  ability: 'accent',
  moves: 'neutral',
  learnset: 'neutral',
  evolution: 'warn',
  item: 'neutral',
  other: 'outline',
}

export const CHANGE_KIND_ORDER: ChangeKind[] = [
  'form',
  'type',
  'stats',
  'ability',
  'learnset',
  'moves',
  'evolution',
  'item',
  'other',
]

/**
 * Encounter methods are displayed exactly as `WildPokemon.txt` spells them.
 *
 * `Morning` / `Day` / `Night` are in-game text, not UI chrome, so they are
 * deliberately left untranslated — the map is now an identity lookup, which
 * keeps it a safe no-op for every consumer.
 */
export const ENCOUNTER_METHOD_LABELS: Record<string, string> = {
  Morning: 'Morning',
  Day: 'Day',
  Night: 'Night',
}

/** Sort options shared by the entity lists. */
export const SORT_LABELS = {
  dexAsc: 'Dex no. (ascending)',
  dexDesc: 'Dex no. (descending)',
  nameAsc: 'Name (A → Z)',
  nameDesc: 'Name (Z → A)',
  deltaDesc: 'BST gain (descending)',
  deltaAsc: 'BST loss (descending)',
  bstDesc: 'Final BST (descending)',
} as const
