import { useMemo } from 'react'
import { keyOf, loadPokemon, loadSinnohan, useData } from './data'

/**
 * Species-name → national dex lookup, built from the two Pokémon datasets.
 * Lets entity lists (trainer rosters, in-game trades) render real sprites even
 * though their source documents only carry species names.
 */
export function useSpeciesDex(): (species: string, sinnohan?: boolean) => number | undefined {
  const { data: pokemon } = useData(loadPokemon)
  const { data: sinnohan } = useData(loadSinnohan)

  const map = useMemo(() => {
    const lookup = new Map<string, number>()
    for (const form of sinnohan ?? []) {
      lookup.set(keyOf(form.name), form.dex)
      lookup.set(keyOf(form.baseName), form.dex)
    }
    for (const entry of pokemon ?? []) {
      lookup.set(keyOf(entry.name), entry.dex)
      lookup.set(keyOf(entry.name.replace(/^Sinnohan\s+/i, '')), entry.dex)
    }
    return lookup
  }, [pokemon, sinnohan])

  return (species: string, isSinnohan = false) =>
    map.get(keyOf(species)) ?? (isSinnohan ? map.get(keyOf(`Sinnohan ${species}`)) : undefined)
}
