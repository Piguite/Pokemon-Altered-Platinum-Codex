import type { PokemonChange, SinnohanForm } from "../types/data"

/**
 * Type changes, told apart from plain typings.
 *
 * The dataset holds three different things that all look like "a list of types":
 *   - `PokemonChange.type`      — a change a document states (`old` → `new`);
 *   - `PokemonChange.baseTypes` — the *vanilla* Gen-IV typing, no change implied;
 *   - `SinnohanForm.types` + `.replacedTypes` — a regional form's typing against
 *     the species it replaces (SinnohanForms.txt).
 *
 * Only the first and the third are changes, and a document always wins over the
 * baseline: nothing here ever rewrites a documented pair with `baseTypes`.
 */

export interface TypeChangePair {
  old: string[]
  new: string[]
}

export interface TypeDiff {
  /** Types present before and after: kept unchanged. */
  kept: string[]
  /** Types the entry gains. */
  gained: string[]
  /** Types the entry loses. */
  lost: string[]
}

/** Split a change into what is kept, gained and lost, preserving source order. */
export function typeDiff(oldTypes: string[], newTypes: string[]): TypeDiff {
  const before = [...new Set(oldTypes)]
  const after = [...new Set(newTypes)]
  return {
    kept: before.filter((type) => after.includes(type)),
    gained: after.filter((type) => !before.includes(type)),
    lost: before.filter((type) => !after.includes(type)),
  }
}

/** True when the two lists actually differ (an empty arrow must never render). */
export function hasTypeChange(oldTypes: string[], newTypes: string[]): boolean {
  const diff = typeDiff(oldTypes, newTypes)
  return diff.gained.length > 0 || diff.lost.length > 0
}

/** The type change a Sinnohan form documents, when it has one. */
export function sinnohanTypeChange(form: SinnohanForm | undefined): TypeChangePair | undefined {
  if (!form || form.types.length === 0) return undefined
  const replaced = form.replacedTypes ?? []
  if (replaced.length === 0 || !hasTypeChange(replaced, form.types)) return undefined
  return { old: replaced, new: form.types }
}

/**
 * The type change to headline for a PokemonChanges entry.
 *
 * `entry.type` is the document's own pair and always wins. Sinnohan entries in
 * `pokemon.json` carry no `type` at all — their typing only exists in
 * SinnohanForms.txt — so the matching form (when the view has it loaded)
 * supplies the pair. Without a documented change there is *no* change to show:
 * `baseTypes` is a baseline typing, never a change.
 */
export function resolveTypeChange(
  entry: PokemonChange,
  form?: SinnohanForm,
): TypeChangePair | undefined {
  if (entry.type) return entry.type
  if (entry.isSinnohan) return sinnohanTypeChange(form)
  return undefined
}

/**
 * Every type an entry is *associated with*: the typing it shows plus the typing
 * it replaced.
 *
 * The type filter and its dropdown are both built from this list, so no type a
 * card displays can be missing from the filter. Four sources feed it, in the
 * order the card itself resolves them:
 *
 *   1. `type.new`   — the changed typing a document states;
 *   2. the matching Sinnohan form's `types`, for the Sinnohan entries of
 *      `pokemon.json`, whose own `type` is always absent;
 *   3. `type.old`   — the typing it had before, still shown struck through;
 *   4. `baseTypes`  — the vanilla typing kept when no change is documented.
 *
 * Nothing here invents a type: an entry contributing none simply has none.
 */
export function effectiveTypes(entry: PokemonChange, form?: SinnohanForm): string[] {
  const types = new Set<string>()
  if (entry.type) {
    for (const type of entry.type.new) types.add(type)
  } else if (entry.isSinnohan) {
    for (const type of form?.types ?? []) types.add(type)
  }
  for (const type of entry.type?.old ?? []) types.add(type)
  for (const type of entry.baseTypes ?? []) types.add(type)
  return [...types]
}
