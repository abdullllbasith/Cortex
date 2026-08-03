'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Columns, X } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { ExportMenu } from './ExportMenu'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export interface FilterChip {
  key: string
  label: string
  value: string
}

export interface DataTableToolbarProps {
  // Search
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  // Active filters shown as chips
  activeFilters?: FilterChip[]
  onRemoveFilter?: (key: string) => void
  onClearFilters?: () => void
  // Filter drawer trigger
  onFilterOpen?: () => void
  filterCount?: number
  // Column visibility
  columns?: Array<{ id: string; header: string; visible: boolean }>
  onColumnVisibilityChange?: (id: string, visible: boolean) => void
  // Export
  data?: unknown[]
  exportFilename?: string
  // Extra actions slot
  actions?: React.ReactNode
  className?: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Column visibility popover
   ───────────────────────────────────────────────────────────────────────────── */

function ColumnsPopover({
  columns,
  onChange,
}: {
  columns: DataTableToolbarProps['columns']
  onChange: DataTableToolbarProps['onColumnVisibilityChange']
}) {
  const [open, setOpen] = useState(false)

  if (!columns?.length) return null

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Columns className="h-3.5 w-3.5" aria-hidden="true" />}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        Columns
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          {/* Panel */}
          <div className={cn(
            'absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border bg-white shadow-lg',
            'dark:bg-slate-900 dark:border-slate-800 border-slate-200',
            'p-2 animate-scaleIn',
          )}>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Toggle columns
            </p>
            {columns.map((col) => (
              <label
                key={col.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5',
                  'text-sm text-slate-700 dark:text-slate-300',
                  'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                )}
              >
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={(e) => onChange?.(col.id, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {col.header}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   DataTableToolbar
   ───────────────────────────────────────────────────────────────────────────── */

export function DataTableToolbar({
  search = '',
  onSearch,
  searchPlaceholder = 'Search…',
  activeFilters = [],
  onRemoveFilter,
  onClearFilters,
  onFilterOpen,
  filterCount = 0,
  columns,
  onColumnVisibilityChange,
  data,
  exportFilename,
  actions,
  className,
}: DataTableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debouncedSearch = useDebounce(localSearch, 300)

  useEffect(() => {
    if (debouncedSearch !== search) onSearch?.(debouncedSearch)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync from outside
  useEffect(() => { setLocalSearch(search) }, [search])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        {onSearch && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              aria-label={searchPlaceholder}
              className={cn(
                'h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 text-sm',
                'text-slate-900 placeholder:text-slate-400 outline-none',
                'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
                'transition-colors',
              )}
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => { setLocalSearch(''); onSearch?.('') }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Filter button */}
          {onFilterOpen && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onFilterOpen}
            >
              Filters
              {filterCount > 0 && (
                <Badge variant="info" size="sm" className="-mr-1 ml-1">
                  {filterCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Columns toggle */}
          {columns && onColumnVisibilityChange && (
            <ColumnsPopover columns={columns} onChange={onColumnVisibilityChange} />
          )}

          {/* Export */}
          {data && <ExportMenu data={data} filename={exportFilename} />}

          {/* Custom actions */}
          {actions}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">Filters:</span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className={cn(
                'flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-2.5 pr-1.5 py-0.5',
                'text-xs font-medium text-indigo-700',
                'dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-300',
              )}
            >
              <span className="text-indigo-400">{filter.label}:</span>
              {filter.value}
              <button
                type="button"
                aria-label={`Remove filter: ${filter.label}`}
                onClick={() => onRemoveFilter?.(filter.key)}
                className="ml-0.5 rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
