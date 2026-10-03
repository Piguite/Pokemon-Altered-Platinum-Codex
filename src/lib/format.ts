import type { StatBlock } from "../types/data"

export type StatKey = keyof Omit<StatBlock, 'bst'>

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

/** Short labels: the game's own abbreviations (English, matching the docs). */
export const STAT_SHORT: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SAtk',
  spd: 'SDef',
  spe: 'Spd',
}

/** Long English labels used in tooltips / accessible names. */
export const STAT_LONG: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
}

export function statTotal(s: StatBlock): number {
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe
}

/** Display max used to scale stat bars (Blissey HP is 255). */
export const STAT_MAX = 255

export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `\u2212${Math.abs(n)}`
  return '0'
}

export function dexLabel(dex: number): string {
  return `#${String(dex).padStart(3, '0')}`
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${value.toLocaleString('en-US')}`
}

/**
 * `1 entry` / `3 entries`.
 *
 * Callers pass the plural form explicitly whenever it is not a plain `+s`
 * (`entry` → `entries`, `category` → `categories`, `boss` → `bosses`), so a
 * label reads correctly for a count of one and for many.
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Case/diacritic-insensitive normalisation used by every client-side filter. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matches(haystack: string, needle: string): boolean {
  if (!needle) return true
  return normalize(haystack).includes(normalize(needle))
}

export function cls(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function bstDelta(a: StatBlock | undefined, b: StatBlock | undefined): number {
  if (!a || !b) return 0
  return a.bst - b.bst
}

/** Percentage used to size a stat bar, clamped to the bar width. */
export function statPercent(value: number): number {
  return Math.max(2, Math.min(100, (value / STAT_MAX) * 100))
}
