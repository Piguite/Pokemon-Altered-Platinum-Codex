import { cls } from "../../lib/format"

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cls('animate-pulse rounded-md bg-surface-3', className)} />
}

/** Placeholder for a card-shaped block of content. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cls('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cls('h-3', index % 3 === 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

/** Placeholder grid for list routes. */
export function SkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cls('grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading data…</span>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} lines={2} />
      ))}
    </div>
  )
}

/** Placeholder rows for table-shaped content. */
export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cls('overflow-hidden rounded-card border border-line bg-surface', className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonText({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cls('space-y-2', className)} aria-busy="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cls('h-3', index % 4 === 3 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}
