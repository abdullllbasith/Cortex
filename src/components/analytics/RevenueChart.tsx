'use client'

import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

interface RevenuePoint {
  date: string
  revenue: number
  margin?: number
  marginPct?: number
  previousRevenue?: number | null
}

interface RevenueChartProps {
  data: RevenuePoint[]
  loading?: boolean
  className?: string
}

const PERIODS = ['Today', 'Week', 'Month', 'Quarter', 'Year'] as const

export function RevenueChart({ data, loading, className }: RevenueChartProps) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('Month')
  const [compare, setCompare] = useState(true)

  if (loading) return <Skeleton className={cn('h-80 w-full rounded-xl', className)} />

  if (!data.length) {
    return (
      <div className={cn('h-80 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400', className)}>
        No revenue data for this period
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revenue & Margin</h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  period === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="rounded" />
            vs previous
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" name="Revenue" radius={[4, 4, 0, 0]} animationDuration={800} />
          {compare && (
            <Line yAxisId="left" type="monotone" dataKey="previousRevenue" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Previous" />
          )}
          <Line yAxisId="right" type="monotone" dataKey="marginPct" stroke="#10b981" strokeWidth={2} dot={false} name="Margin %" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
