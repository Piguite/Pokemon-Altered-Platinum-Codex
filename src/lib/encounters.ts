import { useMemo } from 'react'
import type { WildDoc } from "../types/data"
import { keyOf, loadWild, useData } from './data'

/** One wild slot, flattened: where a species can be found and how often. */
export interface EncounterHit {
  area: string
  levels: string
  method: string
  percent: number
  isSinnohan: boolean
}

export type EncounterLookup = (species: string, sinnohan?: boolean) => EncounterHit[]

const NONE: EncounterHit[] = []

/**
 * Slug for a species *inside the encounter tables*.
 *
 * `keyOf` drops `♂`/`♀`, which would collapse Nidoran♂ and Nidoran♀ into one
 * bucket, so the gender symbols are spelled out before slugging. The `(S)`
 * suffix the source writes for Sinnohan forms is part of the key rather than
 * part of the name — a Sinnohan form and its base species share a live slot in
 * the wild tables and must never be confused with one another.
 */
function encounterKey(species: string, sinnohan: boolean): string {
  const base = species
    .replace(/\((S)\)\s*$/, '')
    .replace(/\u2642/g, ' male')
    .replace(/\u2640/g, ' female')
  return `${keyOf(base)}|${sinnohan ? 's' : 'n'}`
}

/** True when the source spelled the Sinnohan marker inside the species name. */
export function isSinnohanSpecies(species: string, flagged = false): boolean {
  return flagged || /\(S\)\s*$/.test(species)
}

/**
 * Reverse index: species → every wild area it appears in.
 *
 * Built once per `wild.json` payload (see `getEncounterIndex`) so a Pokémon
 * detail page is a single map lookup instead of a scan over ~70 areas.
 */
export function buildEncounterIndex(doc: WildDoc | null | undefined): EncounterLookup {
  const index = new Map<string, EncounterHit[]>()

  for (const area of doc?.areas ?? []) {
    for (const method of area.methods ?? []) {
      for (const slot of method.slots ?? []) {
        const name = typeof slot?.species === 'string' ? slot.species : ''
        if (!name) continue
        const sinnohan = isSinnohanSpecies(name, slot.isSinnohan === true)
        const key = encounterKey(name, sinnohan)
        const hit: EncounterHit = {
          area: area.area,
          levels: area.levels ?? '',
          method: method.method,
          percent: typeof slot.percent === 'number' ? slot.percent : 0,
          isSinnohan: sinnohan,
        }
        const bucket = index.get(key)
        if (bucket) bucket.push(hit)
        else index.set(key, [hit])
      }
    }
  }

  return (species, sinnohan = false) => {
    if (!species) return NONE
    return index.get(encounterKey(species, sinnohan)) ?? NONE
  }
}

let cachedDoc: WildDoc | null | undefined
let cachedLookup: EncounterLookup | null = null

/**
 * The index is memoised on the document identity: `useData` resolves the same
 * object for every consumer in a session, so every detail page shares one pass
 * over `wild.json`.
 */
export function getEncounterIndex(doc: WildDoc | null | undefined): EncounterLookup {
  if (cachedLookup === null || doc !== cachedDoc) {
    cachedDoc = doc
    cachedLookup = buildEncounterIndex(doc)
  }
  return cachedLookup
}

/** Species → wild encounters, ready to render. */
export function useEncounterIndex(): EncounterLookup {
  const { data } = useData(loadWild)
  return useMemo(() => getEncounterIndex(data), [data])
}

/** One area, with every method the species shows up in. */
export interface EncounterAreaGroup {
  area: string
  levels: string
  methods: EncounterHit[]
  /** Best chance of meeting the species in that area. */
  best: number
}

/**
 * Groups hits by area, strongest chance first inside each area.
 *
 * `wild.json` currently holds two distinct tables that share the name "Turnback
 * Cave", so a species listed at the same rate in both arrives twice with the
 * same area/method/percent and would render as a duplicated, unaddressable row.
 * Identical facts are therefore collapsed — one area, one method, one rate is
 * one line for the reader.
 */
export function groupByArea(hits: EncounterHit[]): EncounterAreaGroup[] {
  const groups = new Map<string, EncounterAreaGroup>()
  const seen = new Set<string>()
  for (const hit of hits) {
    const fact = `${hit.area}\u0000${hit.method}\u0000${hit.percent}`
    if (seen.has(fact)) continue
    seen.add(fact)
    const group = groups.get(hit.area)
    if (group) group.methods.push(hit)
    else groups.set(hit.area, { area: hit.area, levels: hit.levels, methods: [hit], best: hit.percent })
  }
  return [...groups.values()]
    .map((group) => {
      group.methods.sort((a, b) => b.percent - a.percent || a.method.localeCompare(b.method, 'en'))
      group.best = group.methods[0]?.percent ?? 0
      return group
    })
    .sort((a, b) => b.best - a.best || a.area.localeCompare(b.area, 'en'))
}
