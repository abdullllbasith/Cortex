'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface HeatmapCell {
  day: number
  hour: number
  value: number
}

interface SalesHeatmapProps {
  data: HeatmapCell[]
  loading?: boolean
  className?: string
}

export function SalesHeatmap({ data, loading, className }: SalesHeatmapProps) {
  if (loading) return <Skeleton className={cn('h-64 w-full rounded-xl', className)} />

  const max = Math.max(...data.map((d) => d.value), 1)

  const getColor = (value: number) => {
    const intensity = value / max
    if (intensity === 0) return 'bg-slate-50 dark:bg-slate-800/40'
    if (intensity < 0.25) return 'bg-indigo-100 dark:bg-indigo-950/40'
    if (intensity < 0.5) return 'bg-indigo-300 dark:bg-indigo-800/60'
    if (intensity < 0.75) return 'bg-indigo-500 dark:bg-indigo-600/80'
    return 'bg-indigo-700 dark:bg-indigo-500'
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-x-auto', className)}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Sales Intensity (Day × Hour)</h3>
      <div className="min-w-[600px]">
        <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-center text-slate-400">{h}</div>
          ))}
          {DAYS.map((dayLabel, day) => (
            <Fragment key={day}>
              <div className="text-xs text-slate-500 flex items-center">{dayLabel}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = data.find((d) => d.day === day && d.hour === hour)
                const value = cell?.value ?? 0
                return (
                  <div
                    key={`${day}-${hour}`}
                    title={`${dayLabel} ${hour}:00 — ${value} sales`}
                    className={cn('aspect-square rounded-sm transition-colors', getColor(value))}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
