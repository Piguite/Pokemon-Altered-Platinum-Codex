import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cls } from "../../lib/format"
import { useTheme } from "../../lib/theme"
import { NAV_ITEMS } from "../../lib/routes"
import { loadMeta, useData } from "../../lib/data"
import { Icon } from "../ui/Icon"
import { Badge } from "../ui/Card"
import { DataBanner } from './DataBanner'
import { SearchOverlay } from './SearchOverlay'

/** Resets scroll position on every route change (deep links included). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function Brand() {
  const { data } = useData(loadMeta)
  const version = data?.version
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-solid text-accent-ink shadow-card">
        <Icon name="pokeball" size={19} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-extrabold tracking-tight text-ink">
          Altered Platinum <span className="text-ink-faint">Codex</span>
        </span>
        <span className="block truncate text-[11px] text-ink-faint">
          {version ? `Documentation ${version}` : 'Interactive documentation'}
        </span>
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  )
}

function SearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open global search"
      className={cls(
        'flex min-w-0 items-center gap-2 rounded-pill border border-line bg-surface-2 px-3 py-2 text-left text-sm text-ink-faint',
        'transition-colors hover:border-line-strong hover:text-ink-muted',
        className,
      )}
    >
      <Icon name="search" size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">Search…</span>
      <span className="hidden shrink-0 items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] sm:flex">
        <span>⌘</span>K
      </span>
    </button>
  )
}

function MobileNav({ onClose, onSearch }: { onClose: () => void; onSearch: () => void }) {
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
        onKeyDown={onClose}
      />
      <nav
        aria-label="Main navigation"
        className="animate-pop absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col border-l border-line bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-ink">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-full p-1.5 text-ink-faint hover:bg-surface-3 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={onSearch}
            className="flex w-full items-center gap-2 rounded-pill border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Icon name="search" size={16} className="shrink-0" />
            <span className="flex-1 text-left">Search the documentation…</span>
          </button>
        </div>
        <ul className="scroll-thin flex-1 overflow-y-auto px-2 pb-6">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  cls(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive ? 'bg-accent/12 font-semibold text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                <Icon name={item.icon} size={17} className="shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  <span className="block truncate text-[11px] text-ink-faint">{item.hint}</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Ctrl/Cmd + K opens the palette from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteCombo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isPaletteCombo) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ScrollToTop />

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[92rem] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex-1" />
          <SearchTrigger onOpen={() => setPaletteOpen(true)} className="hidden w-64 lg:flex xl:w-80" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open global search"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-ink-muted transition-colors hover:text-ink lg:hidden"
          >
            <Icon name="search" size={16} />
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-ink-muted transition-colors hover:text-ink md:hidden"
          >
            <Icon name="menu" size={17} />
          </button>
        </div>

        {/* Desktop section rail */}
        <nav aria-label="Sections" className="hidden border-t border-line md:block">
          <div className="mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-8">
            <ul className="no-scrollbar flex items-center gap-0.5 overflow-x-auto py-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={item.hint}
                    className={({ isActive }) =>
                      cls(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                        isActive ? 'bg-accent/12 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    <Icon name={item.icon} size={15} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      <DataBanner />

      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>

      <Footer />

      <SearchOverlay open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {navOpen ? (
        <MobileNav onClose={() => setNavOpen(false)} onSearch={() => { setNavOpen(false); setPaletteOpen(true) }} />
      ) : null}
    </div>
  )
}

function Footer() {
  const { data } = useData(loadMeta)

  return (
    <footer className="mt-8 border-t border-line bg-canvas-2">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-md">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="pokeball" size={16} className="text-accent" />
              Altered Platinum Codex
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              An interactive transcription of the official documentation for{' '}
              <em>Pokémon Altered Platinum</em> by {data?.originalAuthor ?? 'Drayano'}. Pokémon, move, item
              and area names are kept in English, exactly as they appear in the game and in the source
              documents.
            </p>
          </div>
          <nav aria-label="Footer links" className="text-xs">
            <p className="mb-2 font-semibold tracking-wide text-ink-faint uppercase">Shortcuts</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {NAV_ITEMS.slice(1).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-ink-muted transition-colors hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[11px] text-ink-faint">
            Unofficial fan project — Pokémon © Nintendo, Creatures Inc., GAME FREAK inc.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {data?.version ? <Badge tone="outline">Version {data.version}</Badge> : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
