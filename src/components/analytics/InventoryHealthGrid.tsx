'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button, Skeleton } from '@/components/ui'

interface InventoryItem {
  productId: string
  name: string
  inventoryLevel?: number
  turnoverRate?: number
  reorderPoint?: number
  daysIdle?: number
}

interface InventoryHealthGridProps {
  fastMovers: InventoryItem[]
  deadStock: InventoryItem[]
  reorderRequired: InventoryItem[]
  loading?: boolean
  className?: string
}

type SortKey = 'stock' | 'turnover' | 'days'

function healthColor(item: InventoryItem, type: 'fast' | 'dead' | 'reorder') {
  if (type === 'dead') return 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
  if (type === 'reorder') return 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
  return 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
}

export function InventoryHealthGrid({
  fastMovers,
  deadStock,
  reorderRequired,
  loading,
  className,
}: InventoryHealthGridProps) {
  const [sort, setSort] = useState<SortKey>('stock')

  if (loading) return <Skeleton className={cn('h-64 rounded-xl', className)} />

  const items = [
    ...reorderRequired.map((i) => ({ ...i, type: 'reorder' as const })),
    ...deadStock.map((i) => ({ ...i, type: 'dead' as const })),
    ...fastMovers.map((i) => ({ ...i, type: 'fast' as const })),
  ]

  const sorted = [...items].sort((a, b) => {
    if (sort === 'turnover') return (b.turnoverRate ?? 0) - (a.turnoverRate ?? 0)
    if (sort === 'days') return (b.daysIdle ?? 0) - (a.daysIdle ?? 0)
    return (a.inventoryLevel ?? 0) - (b.inventoryLevel ?? 0)
  })

  if (!sorted.length) {
    return (
      <div className={cn('rounded-xl border border-dashed p-8 text-center text-sm text-slate-400', className)}>
        No inventory data available
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventory Health</h3>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-transparent"
        >
          <option value="stock">Stock level</option>
          <option value="turnover">Turnover rate</option>
          <option value="days">Days idle</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {sorted.slice(0, 12).map((item) => (
          <div key={item.productId} className={cn('rounded-lg border p-3', healthColor(item, item.type))}>
            <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Stock: {item.inventoryLevel ?? '—'}
              {item.turnoverRate != null && ` · Turnover: ${item.turnoverRate}x`}
            </p>
            {item.type === 'reorder' && (
              <Button size="sm" variant="secondary" className="mt-2 h-7 text-xs w-full">
                Create purchase order
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
