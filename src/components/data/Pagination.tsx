'use client'

import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SelectField } from '@/components/ui'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */

export interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  pageSizeOptions?: number[]
  className?: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page range builder with ellipsis
   ───────────────────────────────────────────────────────────────────────────── */

function buildPageRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: Array<number | '…'> = [1]

  if (current > 3) pages.push('…')

  const start = Math.max(2, current - 1)
  const end   = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('…')

  pages.push(total)
  return pages
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pagination
   ───────────────────────────────────────────────────────────────────────────── */

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const totalPages  = Math.max(1, Math.ceil(total / limit))
  const rangeStart  = (page - 1) * limit + 1
  const rangeEnd    = Math.min(page * limit, total)

  const goTo = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) onPageChange(p)
    },
    [totalPages, onPageChange],
  )

  /* Keyboard shortcuts ← → */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowLeft')  goTo(page - 1)
      if (e.key === 'ArrowRight') goTo(page + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [page, goTo])

  const pageSizeData = pageSizeOptions.map((n) => ({
    value: String(n),
    label: `${n} / page`,
  }))

  const pageRange = buildPageRange(page, totalPages)

  const btnCls = (active: boolean, disabled?: boolean) =>
    cn(
      'flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      active
        ? 'border-indigo-600 bg-indigo-600 text-white'
        : disabled
          ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
    )

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      {/* Showing X–Y of Z */}
      <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
        {total === 0
          ? 'No results'
          : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
      </p>

      <div className="flex items-center gap-2">
        {/* Page size selector */}
        <SelectField
          data={pageSizeData}
          value={String(limit)}
          onValueChange={(v) => { onLimitChange(Number(v)); onPageChange(1) }}
          triggerClassName="h-8 text-sm w-[110px]"
        />

        {/* Page buttons */}
        <div className="flex items-center gap-1" role="list">
          {/* Prev */}
          <button
            type="button"
            role="listitem"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
            className={btnCls(false, page <= 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Page numbers */}
          {pageRange.map((p, i) =>
            p === '…' ? (
              <span
                key={`ellipsis-${i}`}
                role="listitem"
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center text-sm text-slate-400"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                role="listitem"
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => goTo(p as number)}
                className={btnCls(p === page)}
              >
                {p}
              </button>
            ),
          )}

          {/* Next */}
          <button
            type="button"
            role="listitem"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => goTo(page + 1)}
            className={btnCls(false, page >= totalPages)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
}
