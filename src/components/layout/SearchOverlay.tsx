import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SearchKind, SearchRecord } from "../../types/data"
import { cls, plural } from "../../lib/format"
import { hashToPath, searchTargetPath } from "../../lib/routes"
import {
  SEARCH_KIND_LABELS,
  SEARCH_KIND_ORDER,
  SEARCH_SHORTCUTS,
  groupHits,
  highlight,
  kindLabel,
  runSearch,
  useSearchIndex,
} from "../../lib/search"
import type { SearchHit } from "../../lib/search"
import { Icon } from "../ui/Icon"
import { TypeBadge } from "../ui/TypeBadge"
import { TYPE_ORDER } from "../../lib/typechart"

const KIND_ICON: Record<SearchKind, 'book' | 'pokeball' | 'sparkles' | 'grid' | 'zap' | 'tag' | 'shuffle' | 'users' | 'mapPin' | 'gift' | 'swap' | 'info' | 'clipboard' | 'list'> = {
  doc: 'book',
  pokemon: 'pokeball',
  sinnohan: 'sparkles',
  type: 'grid',
  move: 'zap',
  item: 'tag',
  evolution: 'shuffle',
  trainer: 'users',
  wild: 'mapPin',
  event: 'gift',
  trade: 'swap',
  npc: 'users',
  faq: 'info',
  guide: 'clipboard',
}

const MAX_RESULTS = 60

/** Badges that are type names render as coloured type chips. */
function isTypeName(value: string): boolean {
  return (TYPE_ORDER as readonly string[]).includes(value) || value === '???'
}

function Highlighted({ text, matches, field }: { text: string; matches: SearchHit['matches']; field: string }) {
  const chunks = highlight(text, matches, field)
  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.hit ? (
          <mark key={index} className="rounded bg-accent/25 px-0.5 text-ink">
            {chunk.text}
          </mark>
        ) : (
          <span key={index}>{chunk.text}</span>
        ),
      )}
    </>
  )
}

export interface SearchOverlayProps {
  open: boolean
  onClose: () => void
}

/**
 * Global command palette. Ctrl/Cmd+K anywhere, or the header search field.
 * Fully keyboard driven: ↑/↓ to move, Enter to open, Esc to dismiss.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate()
  const { fuse, loading } = useSearchIndex()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [kinds, setKinds] = useState<Set<SearchKind>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => runSearch(fuse, query, MAX_RESULTS, kinds), [fuse, query, kinds])
  const groups = useMemo(() => groupHits(hits), [hits])
  const flat = useMemo(() => groups.flatMap((group) => group.hits), [groups])

  const availableKinds = SEARCH_KIND_ORDER

  // Reset when the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setKinds(new Set())
      const id = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query, kinds])

  // Lock background scrolling while open.
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const go = useCallback(
    (record: SearchRecord) => {
      onClose()
      navigate(searchTargetPath(record))
    },
    [navigate, onClose],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => (flat.length === 0 ? 0 : (index + 1) % flat.length))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => (flat.length === 0 ? 0 : (index - 1 + flat.length) % flat.length))
        return
      }
      if (event.key === 'Home' && query === '') {
        event.preventDefault()
        setActive(0)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const hit = flat[active]
        if (hit) go(hit.record)
        else if (query.trim().length > 0) {
          onClose()
          navigate(`/search?q=${encodeURIComponent(query.trim())}`)
        }
      }
    },
    [active, flat, go, navigate, onClose, query],
  )

  // Keep the active row visible.
  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, open, flat.length])

  if (!open) return null

  let runningIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/80 backdrop-blur-sm sm:p-4 sm:pt-[8vh]"
      onKeyDown={onKeyDown}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="animate-pop flex h-full w-full flex-col overflow-hidden border border-line-strong bg-surface shadow-pop sm:h-auto sm:max-h-[76vh] sm:max-w-2xl sm:rounded-card"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Icon name="search" size={18} className="shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for a Pokémon, move, item or area…"
            aria-label="Search the whole documentation"
            aria-controls="palette-results"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Kind filters */}
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
          <button
            type="button"
            aria-pressed={kinds.size === 0}
            onClick={() => setKinds(new Set())}
            className={cls(
              'shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium transition-colors',
              kinds.size === 0 ? 'bg-accent-solid text-accent-ink' : 'bg-surface-2 text-ink-muted hover:text-ink',
            )}
          >
            All
          </button>
          {availableKinds.map((kind) => {
            const isActive = kinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  setKinds((current) => {
                    const next = new Set(current)
                    if (next.has(kind)) next.delete(kind)
                    else next.add(kind)
                    return next
                  })
                }
                className={cls(
                  'shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-accent-solid text-accent-ink' : 'bg-surface-2 text-ink-muted hover:text-ink',
                )}
              >
                {SEARCH_KIND_LABELS[kind]}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div ref={listRef} id="palette-results" role="listbox" aria-label="Results" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">Loading the index…</p>
          ) : query.trim().length === 0 ? (
            <div className="p-1">
              <p className="px-2.5 py-2 text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                Quick links
              </p>
              {SEARCH_SHORTCUTS.map((shortcut) => {
                runningIndex += 1
                const index = runningIndex
                return (
                  <button
                    key={shortcut.route}
                    type="button"
                    data-index={index}
                    role="option"
                    aria-selected={active === index}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      onClose()
                      navigate(hashToPath(shortcut.route))
                    }}
                    className={cls(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      active === index ? 'bg-surface-3' : 'hover:bg-surface-2',
                    )}
                  >
                    <Icon name="arrowRight" size={15} className="shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{shortcut.label}</span>
                      <span className="block truncate text-xs text-ink-muted">{shortcut.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink">No results for “{query}”</p>
              <p className="mt-1 text-xs text-ink-muted">
                Try a Pokémon name in English, a move, an item or an area.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="mb-1">
                <p className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                  <Icon name={KIND_ICON[group.kind]} size={12} />
                  {kindLabel(group.kind)}
                  <span className="nums font-mono normal-case">({group.hits.length})</span>
                </p>
                {group.hits.map((hit) => {
                  runningIndex += 1
                  const index = runningIndex
                  return (
                    <button
                      key={hit.record.id}
                      type="button"
                      data-index={index}
                      role="option"
                      aria-selected={active === index}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(hit.record)}
                      className={cls(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        active === index ? 'bg-surface-3' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          <Highlighted text={hit.record.title} matches={hit.matches} field="title" />
                        </span>
                        {hit.record.subtitle ? (
                          <span className="block truncate text-xs text-ink-muted">{hit.record.subtitle}</span>
                        ) : null}
                      </span>
                      {/* Shrinkable + wrapping so a long badge run cannot widen the palette. */}
                      <span className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
                        {hit.record.badges.slice(0, 3).map((badge) =>
                          isTypeName(badge) ? (
                            <TypeBadge key={badge} type={badge} size="xs" />
                          ) : (
                            <span
                              key={badge}
                              className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-ink-muted"
                            >
                              {badge}
                            </span>
                          ),
                        )}
                        <Icon
                          name="chevronRight"
                          size={15}
                          className={cls('text-ink-faint', active === index ? 'text-ink' : '')}
                        />
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-faint">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↑</kbd>
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd> open
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">Esc</kbd> close
            </span>
          </span>
          {query.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate(`/search?q=${encodeURIComponent(query.trim())}`)
              }}
              className="font-medium text-accent hover:underline"
            >
              See all results
            </button>
          ) : (
            <span className="nums">{hits.length > 0 ? plural(hits.length, 'result') : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
