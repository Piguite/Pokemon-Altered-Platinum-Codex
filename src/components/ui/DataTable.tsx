import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { cls } from "../../lib/format"
import { Icon } from './Icon'

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Value used for sorting; defaults to a string/primitive extraction from `sortAccessor`. */
  sortValue?: (row: T) => string | number
  /** Skip this column in the mobile card layout (e.g. pure actions). */
  hideOnMobile?: boolean
  /** Column shown as the card title on mobile. Defaults to the first column. */
  primary?: boolean
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getKey: (row: T, index: number) => string
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  defaultDir?: 'asc' | 'desc'
  dense?: boolean
  /** Label above the mobile cards (usually the row title). */
  mobileLabel?: string
  className?: string
  /** Rendered when `rows` is empty. */
  empty?: ReactNode
  /** Optional row click handler — renders rows as buttons for keyboard users. */
  onRowClick?: (row: T) => void
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
}

/**
 * Sortable table that degrades into a stacked card list below `md`.
 * Sorting is applied internally so callers only own the `sort` state.
 */
export function DataTable<T>({
  rows,
  columns,
  getKey,
  sort,
  onSortChange,
  defaultDir = 'asc',
  dense = false,
  className,
  empty,
  onRowClick,
}: DataTableProps<T>) {
  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const accessor = column.sortValue
    const copy = [...rows]
    copy.sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * compare(accessor(a), accessor(b)))
    return copy
  }, [rows, columns, sort])

  function toggle(column: Column<T>) {
    if (!column.sortable || !onSortChange) return
    if (sort?.key === column.key) {
      onSortChange({ key: column.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      onSortChange({ key: column.key, dir: defaultDir })
    }
  }

  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>
  }

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0]
  const mobileColumns = columns.filter((c) => !c.hideOnMobile && c !== primaryColumn)
  const cellPad = dense ? 'px-3 py-2' : 'px-3.5 py-2.5'

  return (
    <div className={className}>
      {/* Desktop: real table */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2">
                {columns.map((column) => {
                  const active = sort?.key === column.key
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cls(
                        'border-b border-line px-3.5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        !column.align && 'text-left',
                        column.headerClassName,
                      )}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => toggle(column)}
                          className={cls(
                            'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
                            active && 'text-ink',
                            column.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {column.header}
                          <Icon
                            name={active ? 'chevronDown' : 'sort'}
                            size={13}
                            className={cls('transition-transform', active && sort?.dir === 'asc' && 'rotate-180')}
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => (
                <tr
                  key={getKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cls(
                    'border-b border-line last:border-b-0 transition-colors',
                    index % 2 === 1 && 'bg-surface-2/40',
                    onRowClick && 'cursor-pointer hover:bg-surface-3/60',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cls(
                        cellPad,
                        'align-middle text-ink',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-2 md:hidden">
        {sorted.map((row, index) => {
          const content = (
            <>
              <div className="text-sm font-semibold text-ink">{primaryColumn.cell(row)}</div>
              {mobileColumns.length > 0 ? (
                <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 text-xs">
                  {mobileColumns.map((column) => (
                    <div key={column.key} className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-ink-faint">{column.header}</dt>
                      <dd className="min-w-0 text-right text-ink">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          )
          return (
            <li key={getKey(row, index)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="w-full rounded-card border border-line bg-surface p-3.5 text-left shadow-card"
                >
                  {content}
                </button>
              ) : (
                <div className="rounded-card border border-line bg-surface p-3.5 shadow-card">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
