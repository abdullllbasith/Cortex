'use client'

import {
  useState,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import { Checkbox } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'status' | 'badge' | 'actions' | 'custom'
export type SortDirection = 'asc' | 'desc' | null

export interface ColumnDef<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  header: string
  accessorKey?: keyof TData & string
  type?: ColumnType
  cell?: (info: { row: TData; value: unknown; index: number }) => React.ReactNode
  sortable?: boolean
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  enableResize?: boolean
  enableHiding?: boolean
}

export interface DataTableProps<TData extends Record<string, unknown>> {
  columns: ColumnDef<TData>[]
  data: TData[]
  loading?: boolean
  keyField?: keyof TData & string
  // Selection
  selectable?: boolean
  onSelectionChange?: (rows: TData[]) => void
  bulkActions?: React.ReactNode
  // Sorting
  sortKey?: string
  sortDirection?: SortDirection
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  // Row interactions
  onRowClick?: (row: TData) => void
  rowActions?: (row: TData) => React.ReactNode
  // Layout
  stickyHeader?: boolean
  emptyState?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  /** Columns to hide (by id) */
  hiddenColumns?: Set<string>
  /** Column ids to highlight in mobile card view (defaults to first 3 visible) */
  mobileColumns?: string[]
  className?: string
  /** Number of skeleton rows while loading (default 5) */
  skeletonRowCount?: number
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────────── */

function formatCell(value: unknown, type?: ColumnType): React.ReactNode {
  if (value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>
  switch (type) {
    case 'currency':
      return (
        <span className="font-display font-medium tabular-nums">
          ${(value as number).toLocaleString()}
        </span>
      )
    case 'number':
      return <span className="tabular-nums">{(value as number).toLocaleString()}</span>
    case 'date':
      return new Date(value as string).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    default:
      return String(value)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sort header icon
   ───────────────────────────────────────────────────────────────────────────── */

function SortIcon({ colId, sortKey, direction }: { colId: string; sortKey?: string; direction?: SortDirection }) {
  if (colId !== sortKey || !direction) return <ChevronsUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600" aria-hidden="true" />
  return direction === 'asc'
    ? <ChevronUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
    : <ChevronDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
}

function DataTableMobileCards<TData extends Record<string, unknown>>({
  columns,
  data,
  loading,
  onRowClick,
  rowActions,
  emptyState,
  emptyTitle,
  emptyDescription,
  mobileColumns,
  rowKey,
}: {
  columns: ColumnDef<TData>[]
  data: TData[]
  loading?: boolean
  onRowClick?: (row: TData) => void
  rowActions?: (row: TData) => React.ReactNode
  emptyState?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  mobileColumns?: string[]
  rowKey: (row: TData) => string
}) {
  const cardCols = mobileColumns?.length
    ? columns.filter((c) => mobileColumns.includes(c.id))
    : columns.filter((c) => c.type !== 'actions').slice(0, 3)

  if (loading) {
    return (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 p-4">
            <Skeleton height="14px" className="w-2/3 rounded" />
            <Skeleton height="12px" className="w-1/2 rounded" />
            <Skeleton height="12px" className="w-1/3 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="px-6 py-12">
        {emptyState ?? (
          <EmptyState
            title={emptyTitle ?? 'No data found'}
            description={emptyDescription ?? 'No records match your current filters.'}
          />
        )}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800" role="list">
      {data.map((row, rowIdx) => {
        const primary = cardCols[0]
        const primaryValue = primary?.accessorKey ? row[primary.accessorKey] : undefined

        return (
          <li key={rowKey(row)}>
            <button
              type="button"
              onClick={() => onRowClick?.(row)}
              className={cn(
                'w-full p-4 text-left transition-colors',
                onRowClick && 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
              )}
            >
              {primary && (
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {primary.cell
                    ? primary.cell({ row, value: primaryValue, index: rowIdx })
                    : formatCell(primaryValue, primary.type)}
                </p>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {cardCols.slice(1).map((col) => {
                  const value = col.accessorKey ? row[col.accessorKey] : undefined
                  return (
                    <div key={col.id}>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {col.header}
                      </dt>
                      <dd className="text-xs text-slate-700 dark:text-slate-300">
                        {col.cell
                          ? col.cell({ row, value, index: rowIdx })
                          : formatCell(value, col.type)}
                      </dd>
                    </div>
                  )
                })}
              </dl>

              {rowActions && (
                <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {rowActions(row)}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   DataTable
   ───────────────────────────────────────────────────────────────────────────── */

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  keyField = 'id' as keyof TData & string,
  selectable = false,
  onSelectionChange,
  bulkActions,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  rowActions,
  stickyHeader = false,
  emptyState,
  emptyTitle = 'No data found',
  emptyDescription = 'No records match your current filters.',
  hiddenColumns = new Set(),
  mobileColumns,
  className,
  skeletonRowCount = 5,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null)

  const visibleCols = columns.filter((c) => !hiddenColumns.has(c.id))

  /* ── Selection ────────────────────────────────────────────────────────── */

  const rowKey = (row: TData) => String(row[keyField])

  const toggleAll = useCallback(() => {
    if (selected.size === data.length) {
      setSelected(new Set())
      onSelectionChange?.([])
    } else {
      const all = new Set(data.map(rowKey))
      setSelected(all)
      onSelectionChange?.(data)
    }
  }, [data, selected.size, onSelectionChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = useCallback((row: TData) => {
    const key = rowKey(row)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      onSelectionChange?.(data.filter((r) => next.has(rowKey(r))))
      return next
    })
  }, [data, onSelectionChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected   = data.length > 0 && selected.size === data.length
  const someSelected  = selected.size > 0 && selected.size < data.length

  /* ── Sort ─────────────────────────────────────────────────────────────── */

  const handleSortClick = (col: ColumnDef<TData>) => {
    if (!col.sortable || !onSort) return
    const next: 'asc' | 'desc' = sortKey === col.id && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(col.id, next)
  }

  /* ── Column resize ────────────────────────────────────────────────────── */

  const startResize = useCallback(
    (e: React.MouseEvent, colId: string, currentW: number) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = { colId, startX: e.clientX, startW: currentW }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return
        const { colId: id, startX, startW } = resizeRef.current
        const newW = Math.max(60, startW + (ev.clientX - startX))
        setColWidths((prev) => ({ ...prev, [id]: newW }))
      }

      const onUp = () => {
        resizeRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [],
  )

  /* ── Render ───────────────────────────────────────────────────────────── */

  const colStyle = (col: ColumnDef<TData>): CSSProperties => {
    const w = colWidths[col.id] ?? col.width
    return {
      width:    w ? `${w}px` : undefined,
      minWidth: col.minWidth ? `${col.minWidth}px` : '80px',
      textAlign: col.align ?? 'left',
    }
  }

  const skeletonRows = Array.from({ length: skeletonRowCount })
  const isEmpty = !loading && data.length === 0

  if (isMobile) {
    return (
      <div className={cn('flex flex-col rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden', className)}>
        <DataTableMobileCards
          columns={visibleCols}
          data={data}
          loading={loading}
          onRowClick={onRowClick}
          rowActions={rowActions}
          emptyState={emptyState}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          mobileColumns={mobileColumns}
          rowKey={rowKey}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden', className)}>

      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {selected.size} selected
          </span>
          {bulkActions}
          <button
            type="button"
            onClick={() => { setSelected(new Set()); onSelectionChange?.([]) }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table scroll wrapper */}
      <div className={cn('overflow-x-auto', stickyHeader && 'overflow-y-auto max-h-[600px]')}>
        <table className="w-full min-w-max border-collapse">

          {/* Header */}
          <thead className={cn(
            'bg-slate-50/60 dark:bg-slate-800/40',
            stickyHeader && 'sticky top-0 z-10',
          )}>
            <tr>
              {/* Select-all checkbox */}
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {visibleCols.map((col) => {
                const w = colWidths[col.id] ?? col.width
                return (
                  <th
                    key={col.id}
                    scope="col"
                    style={colStyle(col)}
                    className={cn(
                      'relative px-4 py-3 text-left',
                      'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
                      'whitespace-nowrap border-b border-slate-100 dark:border-slate-800',
                      col.sortable && 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100',
                    )}
                    onClick={() => handleSortClick(col)}
                    aria-sort={
                      sortKey === col.id
                        ? sortDirection === 'asc' ? 'ascending' : 'descending'
                        : 'none'
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && (
                        <SortIcon colId={col.id} sortKey={sortKey} direction={sortDirection} />
                      )}
                    </span>

                    {/* Resize handle */}
                    {col.enableResize !== false && (
                      <div
                        aria-hidden="true"
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize',
                          'opacity-0 hover:opacity-100 hover:bg-indigo-400 transition-opacity',
                        )}
                        onMouseDown={(e) => startResize(e, col.id, w ?? 120)}
                      />
                    )}
                  </th>
                )
              })}

              {/* Row actions column */}
              {rowActions && <th className="w-10 px-4 py-3 border-b border-slate-100 dark:border-slate-800" />}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
            {loading
              ? skeletonRows.map((_, i) => (
                  <tr key={i}>
                    {selectable && (
                      <td className="px-4 py-3">
                        <Skeleton width="w-4" height="16px" className="rounded" />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td key={col.id} className="px-4 py-3">
                        <Skeleton height="13px" className="rounded" style={{ width: `${60 + (i * 13 % 40)}%` }} />
                      </td>
                    ))}
                    {rowActions && <td className="px-4 py-3" />}
                  </tr>
                ))
              : isEmpty
                ? (
                  <tr>
                    <td
                      colSpan={visibleCols.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                      className="px-6 py-12"
                    >
                      {emptyState ?? (
                        <EmptyState title={emptyTitle} description={emptyDescription} />
                      )}
                    </td>
                  </tr>
                )
                : data.map((row, rowIdx) => {
                    const key = rowKey(row)
                    const isSelected = selected.has(key)
                    return (
                      <tr
                        key={key}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          'transition-colors',
                          onRowClick && 'cursor-pointer',
                          isSelected
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30',
                        )}
                      >
                        {/* Checkbox */}
                        {selectable && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(row)}
                              aria-label={`Select row ${rowIdx + 1}`}
                            />
                          </td>
                        )}

                        {/* Data cells */}
                        {visibleCols.map((col) => {
                          const value = col.accessorKey ? row[col.accessorKey] : undefined
                          return (
                            <td
                              key={col.id}
                              style={colStyle(col)}
                              className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                            >
                              {col.cell
                                ? col.cell({ row, value, index: rowIdx })
                                : formatCell(value, col.type)}
                            </td>
                          )
                        })}

                        {/* Row actions */}
                        {rowActions && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              {rowActions(row)}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
