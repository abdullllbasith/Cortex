'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

interface FunnelData {
  visitors: number
  leads: number
  customers: number
  repeat: number
}

interface CustomerFunnelChartProps {
  data: FunnelData
  loading?: boolean
  className?: string
}

export function CustomerFunnelChart({ data, loading, className }: CustomerFunnelChartProps) {
  if (loading) return <Skeleton className={cn('h-64 rounded-xl', className)} />

  const stages = [
    { label: 'Visitors', value: data.visitors, color: 'bg-slate-200 dark:bg-slate-700' },
    { label: 'Leads', value: data.leads, color: 'bg-indigo-200 dark:bg-indigo-800' },
    { label: 'Customers', value: data.customers, color: 'bg-indigo-400 dark:bg-indigo-600' },
    { label: 'Repeat', value: data.repeat, color: 'bg-indigo-600 dark:bg-indigo-500' },
  ]

  const max = stages[0].value || 1

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Customer Funnel</h3>
        <Link href="/analytics/customers" className="text-xs text-indigo-600 hover:underline">View segments →</Link>
      </div>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1].value : null
          const conversion = prev ? Math.round((stage.value / prev) * 100) : 100
          const width = Math.max(20, (stage.value / max) * 100)

          return (
            <div key={stage.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 dark:text-slate-300">{stage.label}</span>
                <span className="text-slate-500">
                  {stage.value.toLocaleString()}
                  {i > 0 && <span className="ml-2 text-xs text-indigo-600">{conversion}% conv.</span>}
                </span>
              </div>
              <div className="h-8 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className={cn('h-full rounded-lg transition-all duration-700', stage.color)}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
