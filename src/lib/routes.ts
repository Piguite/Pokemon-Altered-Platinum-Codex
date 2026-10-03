import type { SearchRecord } from "../types/data"
import { keyOf } from './data'
import type { IconName } from "../components/ui/Icon"

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Short description used in the mobile drawer. */
  hint: string
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', hint: 'Overview', end: true },
  { to: '/pokemon', label: 'Pokémon', icon: 'pokeball', hint: 'Modified entries' },
  { to: '/sinnohan', label: 'Sinnohan', icon: 'sparkles', hint: 'Regional forms' },
  { to: '/types', label: 'Types', icon: 'grid', hint: 'Type chart & Ice rework' },
  { to: '/moves', label: 'Moves', icon: 'zap', hint: 'Replacements & new moves' },
  { to: '/items', label: 'Items', icon: 'tag', hint: 'Prices, TMs, shops' },
  { to: '/evolutions', label: 'Evolutions', icon: 'shuffle', hint: 'Items, levels, methods' },
  { to: '/trainers', label: 'Trainers', icon: 'users', hint: 'Rosters & bosses' },
  { to: '/wild', label: 'Wild', icon: 'mapPin', hint: 'Encounters by area' },
  { to: '/events', label: 'Events', icon: 'gift', hint: 'Gifts & static encounters' },
  { to: '/guides', label: 'Guides', icon: 'book', hint: 'FAQ, level caps, AR codes' },
]

export const GUIDE_LINKS: { to: string; label: string; hint: string; icon: IconName }[] = [
  { to: '/guides/faq', label: 'FAQ', hint: 'Frequently asked questions', icon: 'info' },
  { to: '/guides/npc', label: 'NPC changes', hint: 'Characters and services', icon: 'users' },
  { to: '/guides/trades', label: 'In-game trades', hint: '4 modified trades', icon: 'swap' },
  { to: '/guides/level-caps', label: 'Level caps', hint: 'Recommended level by stage', icon: 'trending' },
  { to: '/guides/action-replay', label: 'Action Replay codes', hint: 'Cheats & quality of life', icon: 'keyboard' },
  { to: '/guides/changelog', label: 'Changelog', hint: 'Version history', icon: 'clipboard' },
]

/**
 * Search records store their route as a hash string (`#/pokemon/charizard`).
 * With HashRouter the router needs the path part only.
 */
export function hashToPath(route: string): string {
  if (route.startsWith('#')) return route.slice(1) || '/'
  return route.startsWith('/') ? route : `/${route}`
}

/** Absolute URL for sharing a deep link. */
export function absoluteUrl(route: string): string {
  if (typeof window === 'undefined') return route
  return `${window.location.origin}${window.location.pathname}#${hashToPath(route)}`
}

/**
 * Turn a search record into a route that actually opens what was clicked.
 *
 * The index stores list-level routes for the "browse" kinds — all 96 wild
 * records point at `#/wild`, every trainer record at `#/trainers`, every
 * modified move at `#/moves`. Following one of those either does nothing (you
 * are already on that page) or lands on the list's *first* entry, so the panel
 * contradicts the result that was clicked. The entity is always in the title,
 * so rebuild the target from it.
 *
 * A route that already carries a query string is trusted as-is.
 */
export function searchTarget(record: SearchRecord): string {
  const route = record.route || '#/'
  const title = (record.title ?? '').trim()
  if (!title || route.includes('?')) return route

  switch (record.kind) {
    case 'wild':
      return `#${wildAreaRoute(title)}`
    case 'trainer':
      return `#${trainerAreaRoute(title)}`
    case 'move':
      return `#/moves?q=${encodeURIComponent(title)}`
    case 'item':
      return `#/items?q=${encodeURIComponent(title)}`
    case 'evolution':
      // Titles read "Poliwhirl evolution change" — search on the species alone.
      return `#/evolutions?q=${encodeURIComponent(title.replace(/\s+evolution changes?$/i, ''))}`
    default:
      return route
  }
}

/** Absolute path (for `navigate`) of a search record's real target. */
export function searchTargetPath(record: SearchRecord): string {
  return hashToPath(searchTarget(record))
}

/**
 * Detail page of a species as the *documents* spell it (trainer rosters, wild
 * tables, trades): `findPokemon` / `findSinnohan` accept every slug variant, so
 * the plain key is enough for both a base species and a Sinnohan form.
 */
export function speciesRoute(species: string, sinnohan = false): string {
  const slug = keyOf(species.replace(/\((S)\)\s*$/i, ''))
  return sinnohan ? `/sinnohan/${slug}` : `/pokemon/${slug}`
}

/** Deep link into the wild-encounters view, pre-selecting an area. */
export function wildAreaRoute(area: string): string {
  return `/wild?area=${encodeURIComponent(area)}`
}

/** Deep link into the trainer view, pre-selecting an area. */
export function trainerAreaRoute(area: string): string {
  return `/trainers?area=${encodeURIComponent(area)}`
}
