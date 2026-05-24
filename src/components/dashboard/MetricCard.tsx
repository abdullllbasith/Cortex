'use client'

import { type CSSProperties } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface MetricCardProps {
  label: string
  value: number | string
  /** Percentage change vs previous period */
  change?: number
  /** Whether a positive change is good (default true) */
  positiveIsGood?: boolean
  /** Small sparkline data (7–14 numbers) */
  sparkline?: number[]
  /** Currency prefix e.g. '$' */
  prefix?: string
  /** Suffix e.g. '%' */
  suffix?: string
  /** Color accent when value is concerning */
  urgent?: boolean
  /** Ratio display e.g. aiCalls */
  numerator?: number
  denominator?: number
  loading?: boolean
  /** Stagger animation delay in ms */
  animationDelay?: number
  className?: string
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

function formatValue(value: number | string, prefix?: string, suffix?: string): string {
  if (typeof value === 'string') return value
  const n = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
      : value.toLocaleString()
  return `${prefix ?? ''}${n}${suffix ?? ''}`
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */

function Sparkline({
  data,
  positive,
}: {
  data: number[]
  positive: boolean
}) {
  const chartData = data.map((value, index) => ({ value, index }))
  const color = positive ? '#22c55e' : '#ef4444'

  return (
    <div className="h-10 w-full min-w-0">
      <ResponsiveContainer width="100%" height={40} minWidth={0}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}

/* ── MetricCard ──────────────────────────────────────────────────────────── */

export function MetricCard({
  label,
  value,
  change,
  positiveIsGood = true,
  sparkline,
  prefix,
  suffix,
  urgent = false,
  numerator,
  denominator,
  loading = false,
  animationDelay = 0,
  className,
}: MetricCardProps) {
  const cardStyle: CSSProperties = {
    animationDelay: `${animationDelay}ms`,
  }

  if (loading) {
    return (
      <Card className={cn('p-4 animate-fadeIn', className)} style={cardStyle}>
        <div className="flex flex-col gap-3">
          <Skeleton height="12px" width="w-2/3" className="rounded" />
          <Skeleton height="28px" width="w-1/2" className="rounded" />
          <Skeleton height="40px" className="rounded" />
          <Skeleton height="12px" width="w-1/3" className="rounded" />
        </div>
      </Card>
    )
  }

  const isPositiveChange = (change ?? 0) >= 0
  const isGoodChange = positiveIsGood ? isPositiveChange : !isPositiveChange
  const changeColor = isGoodChange ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown

  const displayValue =
    numerator !== undefined && denominator !== undefined
      ? `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`
      : formatValue(value, prefix, suffix)

  return (
    <Card
      className={cn(
        'p-4 animate-fadeIn transition-shadow hover:shadow-md',
        urgent && Number(value) > 0 && 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10',
        className,
      )}
      style={cardStyle}
    >
      {/* Label */}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>

      {/* Value */}
      <p
        className={cn(
          'mt-1 font-display text-2xl font-bold tabular-nums leading-none',
            urgent && Number(value) > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-900 dark:text-slate-100',
        )}
      >
        {displayValue}
      </p>

      {/* Progress bar for ratio metrics */}
      {numerator !== undefined && denominator !== undefined && (
        <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${Math.min(100, (numerator / denominator) * 100).toFixed(1)}%` }}
          />
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparkline} positive={isGoodChange} />
        </div>
      )}

      {/* Change indicator */}
      {change !== undefined && (
        <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', changeColor)}>
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          <span>{Math.abs(change).toFixed(1)}% vs yesterday</span>
        </div>
      )}

      {/* Ratio label */}
      {numerator !== undefined && denominator !== undefined && (
        <p className="mt-1 text-xs text-slate-400">
          {((numerator / denominator) * 100).toFixed(0)}% of plan used
        </p>
      )}
    </Card>
  )
}
