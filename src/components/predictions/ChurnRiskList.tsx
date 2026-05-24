'use client'

import { useState } from 'react'
import { Mail, Phone, UserPlus } from 'lucide-react'
import { Badge, Button, Checkbox, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface ChurnRiskItem {
  customerId: string
  customerName: string
  churnProbability: number
  churnRisk: 'high' | 'medium' | 'low'
  daysToChurn: number | null
  ltvAtRisk: number
  retentionActions: string[]
}

interface ChurnRiskListProps {
  items: ChurnRiskItem[]
  loading?: boolean
  className?: string
}

const riskColors = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
}

export function ChurnRiskList({ items, loading, className }: ChurnRiskListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map((i) => i.customerId)))
  }

  if (loading) return <Skeleton className={cn('h-64 w-full rounded-xl', className)} />

  return (
    <div className={cn('space-y-3', className)}>
      {items.length > 1 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <Checkbox checked={selected.size === items.length && items.length > 0} onCheckedChange={toggleAll} />
            Select all ({selected.size})
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => alert(`Retention campaign queued for ${selected.size} customers`)}
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            Send retention campaign
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-400">
          No churn predictions available
        </div>
      ) : items.map((item) => (
        <div
          key={item.customerId}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected.has(item.customerId)}
              onCheckedChange={() => toggle(item.customerId)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.customerName}</span>
                <Badge variant={item.churnRisk === 'high' ? 'danger' : item.churnRisk === 'medium' ? 'warning' : 'success'} size="sm">
                  {item.churnRisk} risk
                </Badge>
                {item.daysToChurn != null && (
                  <span className="text-xs text-slate-500">~{item.daysToChurn} days to churn</span>
                )}
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Churn probability</span>
                  <span>{Math.round(item.churnProbability * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', riskColors[item.churnRisk])}
                    style={{ width: `${item.churnProbability * 100}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                LTV at risk: <span className="font-medium text-slate-700 dark:text-slate-300">${item.ltvAtRisk.toLocaleString()}</span>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => alert(`Retention offer sent to ${item.customerName}`)}>
                  <Mail className="h-3 w-3 mr-1" /> Send offer
                </Button>
                <Button variant="secondary" size="sm" onClick={() => alert(`Assigned ${item.customerName} to sales rep`)}>
                  <UserPlus className="h-3 w-3 mr-1" /> Assign rep
                </Button>
                <Button variant="secondary" size="sm" onClick={() => alert(`Call scheduled for ${item.customerName}`)}>
                  <Phone className="h-3 w-3 mr-1" /> Schedule call
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
