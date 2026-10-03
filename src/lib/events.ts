import { useMemo } from 'react'
import type { EventsDoc } from '../types/data'
import { loadEvents, useData } from './data'

/**
 * "Where is it obtained?" — the `SpecialEvents.txt` rows that mention a species.
 *
 * The form-change pipeline note points here: no document describes *how* a form
 * is changed, but the events document does say where the Pokémon comes from.
 * Matching is deliberately blunt (the species name as a whole word anywhere in
 * the row) because the source writes rows as `#479 Rotom` / `Old Chateau`.
 */
export interface SpeciesEvent {
  /** Source section title, e.g. "Special Encounters". */
  section: string
  /** Row title as the document writes it, e.g. "#479 Rotom". */
  title: string
  location?: string
  level?: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findSpeciesEvents(doc: EventsDoc | null, species: string): SpeciesEvent[] {
  const name = species.replace(/^Sinnohan\s+/i, '').trim()
  if (!doc || name.length < 3) return []
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}([^a-z0-9]|$)`, 'i')

  const out: SpeciesEvent[] = []
  for (const section of doc.sections) {
    for (const item of section.items) {
      const haystack = `${item.title} ${item.location ?? ''} ${item.lines.join(' ')}`
      if (!pattern.test(haystack)) continue
      out.push({
        section: section.title,
        title: item.title,
        ...(item.location ? { location: item.location } : {}),
        ...(item.level ? { level: item.level } : {}),
      })
    }
  }
  return out
}

export function useSpeciesEvents(species: string): SpeciesEvent[] {
  const { data } = useData(loadEvents)
  return useMemo(() => findSpeciesEvents(data, species), [data, species])
}
