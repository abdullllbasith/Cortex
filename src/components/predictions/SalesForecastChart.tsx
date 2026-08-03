'use client'

import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

interface ForecastPoint {
  date: string
  predictedRevenue: number
  lowerBound: number
  upperBound: number
  confidence?: number
}

interface HistoricalPoint {
  date: string
  actualRevenue: number
}

interface SalesForecastChartProps {
  historical: HistoricalPoint[]
  forecast: ForecastPoint[]
  trendPct?: number
  trendDirection?: 'up' | 'down' | 'flat'
  loading?: boolean
  horizon: number
  onHorizonChange: (h: 7 | 30 | 90) => void
  className?: string
}

export function SalesForecastChart({
  historical,
  forecast,
  trendPct = 0,
  trendDirection = 'flat',
  loading,
  horizon,
  onHorizonChange,
  className,
}: SalesForecastChartProps) {
  const [showConfidence, setShowConfidence] = useState(true)

  if (loading) return <Skeleton className={cn('h-96 w-full rounded-xl', className)} />

  const chartData = [
    ...historical.slice(-60).map((h) => ({
      date: h.date.slice(5),
      actual: h.actualRevenue,
      forecast: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    })),
    ...forecast.slice(0, horizon).map((f) => ({
      date: f.date.slice(5),
      actual: null as number | null,
      forecast: f.predictedRevenue,
      lower: f.lowerBound,
      upper: f.upperBound,
    })),
  ]

  const trendLabel =
    trendDirection === 'up'
      ? `Revenue expected to grow ${Math.abs(trendPct)}% next month`
      : trendDirection === 'down'
        ? `Revenue expected to decline ${Math.abs(trendPct)}% next month`
        : 'Revenue expected to remain stable next month'

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Sales Forecast</h3>
          <p className={cn(
            'text-xs mt-0.5',
            trendDirection === 'up' ? 'text-emerald-600' : trendDirection === 'down' ? 'text-red-600' : 'text-slate-500',
          )}>
            {trendLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            {([7, 30, 90] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onHorizonChange(h)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  horizon === h ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {h}d
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={showConfidence} onChange={(e) => setShowConfidence(e.target.checked)} className="rounded" />
            CI band
          </label>
        </div>
      </div>

      {!chartData.length ? (
        <div className="h-80 flex items-center justify-center text-sm text-slate-400">No forecast data — run prediction refresh</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? `$${v.toLocaleString()}` : '—')} />
            {showConfidence && (
              <Area type="monotone" dataKey="upper" stroke="none" fill="#6366f133" connectNulls={false} />
            )}
            {showConfidence && (
              <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" connectNulls={false} />
            )}
            <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} dot={false} name="Actual" connectNulls />
            <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Forecast" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
