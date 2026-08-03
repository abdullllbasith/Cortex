'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

const PRESETS: { label: string; period: AnalyticsPeriod }[] = [
  { label: 'Today', period: 'today' },
  { label: 'Last 7 days', period: 'week' },
  { label: 'This month', period: 'month' },
  { label: 'Last month', period: 'last_month' },
  { label: 'This quarter', period: 'quarter' },
  { label: 'Custom', period: 'custom' },
]

const STORAGE_KEY = 'saios-analytics-period'

interface AnalyticsDateRangePickerProps {
  className?: string
}

export function AnalyticsDateRangePicker({ className }: AnalyticsDateRangePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    const urlPeriod = searchParams.get('period') as AnalyticsPeriod | null
    const urlStart = searchParams.get('startDate') ?? ''
    const urlEnd = searchParams.get('endDate') ?? ''

    if (urlPeriod) {
      setPeriod(urlPeriod)
      setStartDate(urlStart)
      setEndDate(urlEnd)
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { period: AnalyticsPeriod; startDate?: string; endDate?: string }
        setPeriod(parsed.period)
        setStartDate(parsed.startDate ?? '')
        setEndDate(parsed.endDate ?? '')
      }
    } catch { /* ignore */ }
  }, [searchParams])

  const apply = useCallback((nextPeriod: AnalyticsPeriod, start?: string, end?: string) => {
    setPeriod(nextPeriod)
    const s = start ?? startDate
    const e = end ?? endDate

    const params = new URLSearchParams(searchParams.toString())
    params.set('period', nextPeriod)
    if (nextPeriod === 'custom' && s && e) {
      params.set('startDate', s)
      params.set('endDate', e)
    } else {
      params.delete('startDate')
      params.delete('endDate')
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period: nextPeriod, startDate: s, endDate: e }))
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams, startDate, endDate])

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Calendar className="w-4 h-4 text-slate-400" />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => apply(p.period)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
              period === p.period
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <button
            type="button"
            onClick={() => apply('custom', startDate, endDate)}
            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
