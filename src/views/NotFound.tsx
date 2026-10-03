import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from "../lib/routes"
import { Icon } from "../components/ui/Icon"
import { EmptyState } from "../components/ui/EmptyState"

export function NotFound() {
  const location = useLocation()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EmptyState
        icon="alert"
        titleAs="h1"
        title="Page not found"
        description={
          <>
            The route <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink">{location.pathname}</code>{' '}
            does not exist. Use the global search (⌘K / Ctrl+K) or one of the shortcuts below.
          </>
        }
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-pill bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            <Icon name="home" size={16} />
            Back to the dashboard
          </Link>
        }
      />

      <section aria-labelledby="notfound-nav">
        <h2 id="notfound-nav" className="mb-3 text-sm font-semibold text-ink">
          All sections
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong"
              >
                <Icon name={item.icon} size={17} className="shrink-0 text-ink-faint" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
                  <span className="block truncate text-xs text-ink-faint">{item.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
