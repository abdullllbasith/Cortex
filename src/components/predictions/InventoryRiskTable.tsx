'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ShoppingCart } from 'lucide-react'
import { Badge, Button, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface InventoryRiskItem {
  productId: string
  productName: string
  currentStock: number
  dailyConsumptionRate: number
  predictedStockOutDate: string | null
  reorderQuantity: number
  recommendedOrderDate: string | null
  urgencyLevel: 'critical' | 'warning' | 'normal'
}

interface InventoryRiskTableProps {
  items: InventoryRiskItem[]
  loading?: boolean
  className?: string
}

type SortKey = 'productName' | 'currentStock' | 'daysRemaining' | 'urgencyLevel'

const urgencyVariant = {
  critical: 'danger' as const,
  warning: 'warning' as const,
  normal: 'success' as const,
}

function daysRemaining(stockOutDate: string | null): number | null {
  if (!stockOutDate) return null
  return Math.ceil((new Date(stockOutDate).getTime() - Date.now()) / 86400000)
}

export function InventoryRiskTable({ items, loading, className }: InventoryRiskTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('urgencyLevel')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = useMemo(() => {
    const urgencyOrder = { critical: 0, warning: 1, normal: 2 }
    return [...items].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'productName') cmp = a.productName.localeCompare(b.productName)
      else if (sortKey === 'currentStock') cmp = a.currentStock - b.currentStock
      else if (sortKey === 'daysRemaining') {
        cmp = (daysRemaining(a.predictedStockOutDate) ?? 999) - (daysRemaining(b.predictedStockOutDate) ?? 999)
      } else {
        cmp = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel]
      }
      return sortAsc ? cmp : -cmp
    })
  }, [items, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  function createPO(item: InventoryRiskItem) {
    const params = new URLSearchParams({
      draft: '1',
      productId: item.productId,
      quantity: String(item.reorderQuantity),
    })
    router.push(`/workflows?action=create-po&${params.toString()}`)
  }

  if (loading) return <Skeleton className={cn('h-64 w-full rounded-xl', className)} />

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs text-slate-500">
            <tr>
              {[
                { key: 'productName' as SortKey, label: 'Product' },
                { key: 'currentStock' as SortKey, label: 'Current Stock' },
                { key: 'daysRemaining' as SortKey, label: 'Days Remaining' },
              ].map((col) => (
                <th key={col.key} className="px-4 py-2.5 font-medium">
                  <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-slate-700">
                    {col.label} <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5 font-medium">Stock-out Date</th>
              <th className="px-4 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort('urgencyLevel')} className="inline-flex items-center gap-1 hover:text-slate-700">
                  Urgency <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No inventory risk predictions</td></tr>
            ) : sorted.map((item) => {
              const days = daysRemaining(item.predictedStockOutDate)
              return (
                <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.productName}</td>
                  <td className="px-4 py-3">{item.currentStock}</td>
                  <td className="px-4 py-3">{days ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{item.predictedStockOutDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={urgencyVariant[item.urgencyLevel]} size="sm">
                      {item.urgencyLevel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {item.urgencyLevel !== 'normal' && (
                      <Button variant="secondary" size="sm" onClick={() => createPO(item)}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                        Create PO
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
