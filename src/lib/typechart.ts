import type { PType, TypeChartChange } from "../types/data"

/**
 * Standard Generation VI+ type chart (which is what Altered Platinum is based on,
 * plus the hack's own Ice rework applied on top of it at runtime).
 *
 * Each attacker lists only the defenders it hits for something other than 1×.
 */
export const TYPE_ORDER: PType[] = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
]

interface Effectiveness {
  x2?: PType[]
  x05?: PType[]
  x0?: PType[]
}

export const BASE_CHART: Record<PType, Effectiveness> = {
  Normal: { x05: ['Rock', 'Steel'], x0: ['Ghost'] },
  Fire: { x2: ['Grass', 'Ice', 'Bug', 'Steel'], x05: ['Fire', 'Water', 'Rock', 'Dragon'] },
  Water: { x2: ['Fire', 'Ground', 'Rock'], x05: ['Water', 'Grass', 'Dragon'] },
  Electric: { x2: ['Water', 'Flying'], x05: ['Electric', 'Grass', 'Dragon'], x0: ['Ground'] },
  Grass: {
    x2: ['Water', 'Ground', 'Rock'],
    x05: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'],
  },
  Ice: { x2: ['Grass', 'Ground', 'Flying', 'Dragon'], x05: ['Fire', 'Water', 'Ice', 'Steel'] },
  Fighting: {
    x2: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],
    x05: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'],
    x0: ['Ghost'],
  },
  Poison: { x2: ['Grass', 'Fairy'], x05: ['Poison', 'Ground', 'Rock', 'Ghost'], x0: ['Steel'] },
  Ground: { x2: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], x05: ['Grass', 'Bug'], x0: ['Flying'] },
  Flying: { x2: ['Grass', 'Fighting', 'Bug'], x05: ['Electric', 'Rock', 'Steel'] },
  Psychic: { x2: ['Fighting', 'Poison'], x05: ['Psychic', 'Steel'], x0: ['Dark'] },
  Bug: {
    x2: ['Grass', 'Psychic', 'Dark'],
    x05: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'],
  },
  Rock: { x2: ['Fire', 'Ice', 'Flying', 'Bug'], x05: ['Fighting', 'Ground', 'Steel'] },
  Ghost: { x2: ['Psychic', 'Ghost'], x05: ['Dark'], x0: ['Normal'] },
  Dragon: { x2: ['Dragon'], x05: ['Steel'], x0: ['Fairy'] },
  Dark: { x2: ['Psychic', 'Ghost'], x05: ['Fighting', 'Dark', 'Fairy'] },
  Steel: { x2: ['Ice', 'Rock', 'Fairy'], x05: ['Fire', 'Water', 'Electric', 'Steel'] },
  Fairy: { x2: ['Fighting', 'Dragon', 'Dark'], x05: ['Fire', 'Poison', 'Steel'] },
  '???': {},
}

/** Vanilla multiplier for one attacker/defender pair. */
export function baseMultiplier(attacker: PType, defender: PType): number {
  const row = BASE_CHART[attacker]
  if (!row) return 1
  if (row.x0?.includes(defender)) return 0
  if (row.x2?.includes(defender)) return 2
  if (row.x05?.includes(defender)) return 0.5
  return 1
}

export interface ChartOverride {
  attacker: string
  defender: string
  oldMultiplier: number
  newMultiplier: number
  note?: string
}

export interface ResolvedChart {
  /** altered multiplier, keyed `${attacker}|${defender}` */
  altered: Map<string, number>
  /** vanilla multiplier, keyed `${attacker}|${defender}` */
  vanilla: Map<string, number>
  overrides: Map<string, ChartOverride>
}

export function cellKey(attacker: string, defender: string): string {
  return `${attacker}|${defender}`
}

/**
 * Build the vanilla and altered matrices from the hack's `chartChanges`.
 * Cells not listed in the source keep their vanilla value in both matrices.
 */
export function resolveChart(changes: TypeChartChange[] | undefined | null): ResolvedChart {
  const vanilla = new Map<string, number>()
  const altered = new Map<string, number>()
  const overrides = new Map<string, ChartOverride>()
  for (const atk of TYPE_ORDER) {
    for (const def of TYPE_ORDER) {
      const m = baseMultiplier(atk, def)
      vanilla.set(cellKey(atk, def), m)
      altered.set(cellKey(atk, def), m)
    }
  }
  for (const c of changes ?? []) {
    if (!TYPE_ORDER.includes(c.attacker as PType) || !TYPE_ORDER.includes(c.defender as PType)) continue
    const key = cellKey(c.attacker, c.defender)
    vanilla.set(key, c.oldMultiplier)
    altered.set(key, c.newMultiplier)
    overrides.set(key, c)
  }
  return { altered, vanilla, overrides }
}

export function formatMultiplier(m: number): string {
  if (m === 0) return '0×'
  if (m === 0.25) return '¼×'
  if (m === 0.5) return '½×'
  if (m === 1) return '1×'
  if (m === 2) return '2×'
  if (m === 4) return '4×'
  return `${m}×`
}

/* ------------------------------------------------------------------ */
/* Type colours — authentic per-type hues, with contrast-safe ink.     */
/* ------------------------------------------------------------------ */

export const TYPE_COLORS: Record<PType, string> = {
  Normal: '#9fa19f',
  // Slightly lightened from the canonical #e62829 so that the badge label reaches 4.5:1.
  Fire: '#ef3b32',
  Water: '#2980ef',
  Electric: '#f2c200',
  Grass: '#3fa129',
  Ice: '#3dcef3',
  Fighting: '#ff8000',
  Poison: '#9141cb',
  Ground: '#915121',
  Flying: '#7fb2e8',
  Psychic: '#ef4179',
  Bug: '#8fa119',
  Rock: '#a8a078',
  Ghost: '#704170',
  Dragon: '#5060e1',
  Dark: '#5c4a4b',
  Steel: '#4f93aa',
  Fairy: '#ee6fee',
  '???': '#68a090',
}

const FALLBACK_COLOR = '#6b7488'

export function typeColor(type: string | undefined | null): string {
  if (!type) return FALLBACK_COLOR
  return TYPE_COLORS[type as PType] ?? FALLBACK_COLOR
}

/** Human label for a type as it appears in the source documents (English). */
export function typeLabel(type: string): string {
  return type
}

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/**
 * Ink colour that maximises contrast against the given badge background.
 *
 * 0.179 is the exact relative luminance where black and white yield the same
 * contrast ratio, so this always picks the better of the two. With the palette
 * above, every type chip reaches at least 4.5:1 (WCAG AA, normal text).
 */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.179 ? '#0c0f16' : '#ffffff'
}
