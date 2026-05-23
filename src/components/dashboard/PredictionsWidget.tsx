'use client'

import useSWR from 'swr'
import { TrendingUp, ArrowRight, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ExecutiveData, Prediction } from './types'

export function PredictionsWidget() {
  const router = useRouter()
  const { data, isLoading } = useSWR<ExecutiveData>('/api/analytics/executive')

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Upcoming Predictions
          </h2>
        </div>
        <button
          type="button"
          onClick={() => router.push('/predictions')}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
        {isLoading || !data
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-1.5">
                <Skeleton height="12px" width="w-3/4" className="rounded" />
                <Skeleton height="10px" width="w-1/2" className="rounded" />
              </div>
            ))
          : data.predictions.map((p: Prediction) => (
              <div
                key={p.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <Badge variant={p.severity} size="sm" className="mt-0.5 shrink-0">
                  {p.severity === 'danger' ? 'Critical' : 'Watch'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                    {p.event}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      {p.daysOut === 1 ? 'tomorrow' : `in ${p.daysOut} days`}
                    </span>
                    <span
                      className={cn(
                        'font-semibold',
                        p.confidence >= 85
                          ? 'text-red-500'
                          : p.confidence >= 70
                            ? 'text-amber-500'
                            : 'text-slate-400',
                      )}
                    >
                      {p.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
