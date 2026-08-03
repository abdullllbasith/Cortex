'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'

export interface KPIMetric {
  id?: string
  value: number
  change: number
  label: string
  prefix?: string
  suffix?: string
  sparkline?: number[]
  rag?: 'green' | 'amber' | 'red'
}

interface KPIScorecardProps {
  metrics: KPIMetric[]
  loading?: boolean
  className?: string
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 600
    const start = display
    const diff = value - start
    const startTime = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      setDisplay(start + diff * progress)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  const formatted = prefix === '$'
    ? display.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : Math.round(display * 10) / 10

  return <span>{prefix}{formatted}{suffix}</span>
}

const RAG_STYLES = {
  green: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30',
  amber: 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30',
  red: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30',
}

export function KPIScorecard({ metrics, loading, className }: KPIScorecardProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {metrics.map((m, index) => (
        <div
          key={m.id ?? `${m.label}-${index}`}
          className={cn(
            'rounded-xl border p-4 dark:bg-slate-900/50',
            m.rag ? RAG_STYLES[m.rag] : 'border-slate-200 bg-white dark:border-slate-700',
          )}
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} />
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              m.change > 0 ? 'text-emerald-600' : m.change < 0 ? 'text-red-600' : 'text-slate-400',
            )}>
              {m.change > 0 ? <ArrowUp className="w-3 h-3" /> : m.change < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(m.change)}%
            </span>
            {m.sparkline && m.sparkline.length > 0 && (
              <div className="h-8 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.sparkline.map((v, i) => ({ i, v }))}>
                    <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
