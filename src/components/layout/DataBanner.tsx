import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStatus } from "../../lib/data"
import { Icon } from "../ui/Icon"

/**
 * Discreet notice shown while `public/data/*.json` is incomplete: the app then
 * runs on fallback fixtures instead of failing.
 */
export function DataBanner() {
  const status = useDataStatus()
  const [open, setOpen] = useState(false)

  if (!status.degraded) return null

  const files = status.missing

  return (
    <div className="border-b border-warn/30 bg-warn/10">
      <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
        <Icon name="alert" size={15} className="shrink-0 text-warn" />
        <p className="min-w-0 flex-1 text-xs text-ink-muted">
          <span className="font-semibold text-ink">Some content is not available yet.</span>{' '}
          {files.length === 1
            ? 'One part of the documentation has'
            : `${files.length} parts of the documentation have`}{' '}
          not been published yet: the affected pages show placeholder content for now.
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="shrink-0 text-xs font-medium text-warn hover:underline"
        >
          {open ? 'Hide' : 'Show details'}
        </button>
      </div>
      {open ? (
        <div className="mx-auto w-full max-w-[92rem] px-4 pb-3 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <li
                key={file}
                className="rounded-pill border border-line bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink-faint"
              >
                public/data/{file}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-faint">
            These pages fill in again as soon as their content is available.{' '}
            <Link to="/" className="text-accent hover:underline">
              Back to the dashboard
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
