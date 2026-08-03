'use client'

import { type CSSProperties } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { LazyMetricSparkline } from '@/lib/lazy/components'
import type { SparklineTone } from './MetricSparkline'

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface MetricCardProps {
  label: string
  value?: number | string
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

/** Compare early vs late averages to decide sparkline direction. */
function seriesTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat'
  const mid = Math.max(1, Math.floor(data.length / 2))
  const early = data.slice(0, mid)
  const late = data.slice(mid)
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const a = avg(early)
  const b = avg(late)
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  if (Math.abs(b - a) / scale < 0.03) return 'flat'
  return b > a ? 'up' : 'down'
}

function resolveSparklineTone(opts: {
  urgent: boolean
  urgentActive: boolean
  change?: number
  positiveIsGood: boolean
  sparkline?: number[]
}): SparklineTone {
  const { urgent, urgentActive, change, positiveIsGood, sparkline } = opts

  if (urgent && urgentActive) return 'alert'

  if (change !== undefined) {
    const isPositiveChange = change >= 0
    const isGood = positiveIsGood ? isPositiveChange : !isPositiveChange
    if (change === 0) return 'neutral'
    return isGood ? 'good' : 'bad'
  }

  if (sparkline && sparkline.length > 1) {
    const trend = seriesTrend(sparkline)
    if (trend === 'flat') return 'neutral'
    const risingIsGood = positiveIsGood
    const isGood = trend === 'up' ? risingIsGood : !risingIsGood
    return isGood ? 'good' : 'bad'
  }

  return 'neutral'
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

function formatValue(value: number | string | null | undefined, prefix?: string, suffix?: string): string {
  if (value == null || value === '') {
    return `${prefix ?? ''}0${suffix ?? ''}`
  }
  if (typeof value === 'string') return value
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `${prefix ?? ''}0${suffix ?? ''}`
  }
  const n = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
      : value.toLocaleString()
  return `${prefix ?? ''}${n}${suffix ?? ''}`
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

  const isRatio = numerator !== undefined || denominator !== undefined
  const safeNumerator = numerator ?? 0
  const safeDenominator = denominator ?? 0
  const safeValue = value ?? 0
  const urgentActive = urgent && Number(safeValue) > 0
  const sparkTone = resolveSparklineTone({
    urgent,
    urgentActive,
    change,
    positiveIsGood,
    sparkline,
  })

  const displayValue = isRatio
    ? `${safeNumerator.toLocaleString()} / ${safeDenominator.toLocaleString()}`
    : formatValue(safeValue, prefix, suffix)

  return (
    <Card
      className={cn(
        'p-4 animate-fadeIn transition-shadow hover:shadow-md',
        urgent && Number(safeValue) > 0 && 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10',
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
            urgent && Number(safeValue) > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-900 dark:text-slate-100',
        )}
      >
        {displayValue}
      </p>

      {/* Progress bar for ratio metrics */}
      {isRatio && (
        <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{
              width: `${safeDenominator > 0 ? Math.min(100, (safeNumerator / safeDenominator) * 100) : 0}%`,
            }}
          />
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div
          className={cn(
            'mt-3 h-11 w-full min-w-0 overflow-hidden rounded-md',
            'bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-800/40 dark:to-transparent',
            'px-0.5 pt-1',
          )}
        >
          <LazyMetricSparkline data={sparkline} tone={sparkTone} />
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
      {isRatio && (
        <p className="mt-1 text-xs text-slate-400">
          {safeDenominator > 0
            ? `${((safeNumerator / safeDenominator) * 100).toFixed(0)}% of plan used`
            : '0% of plan used'}
        </p>
      )}
    </Card>
  )
}
