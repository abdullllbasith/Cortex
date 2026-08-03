'use client'

import { Bot, RefreshCw, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useExecutiveDashboard } from './ExecutiveDashboardProvider'

export function InsightBanner() {
  const { data, isLoading, mutate } = useExecutiveDashboard()

  const handleRefresh = () => {
    void mutate()
  }

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-r',
        'from-indigo-50 to-indigo-50/40 px-5 py-4',
        'dark:border-indigo-800/40 dark:from-indigo-950/40 dark:to-indigo-950/10',
      )}
    >
      {/* Background orb decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl"
      />

      <div className="relative flex items-start gap-4 min-h-[5.5rem]">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
          <Bot className="h-5 w-5 text-white" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Cortex Intelligence
            </span>
          </div>

          {/* Content */}
          {isLoading || !data ? (
            <div className="space-y-2">
              <Skeleton height="14px" className="rounded" />
              <Skeleton height="14px" width="w-4/5" className="rounded" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {data.insight.summary}
            </p>
          )}

          {/* Timestamp */}
          {data && !isLoading && (
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              Generated {new Date(data.insight.generatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh AI insight"
          disabled={isLoading}
          className={cn(
            'shrink-0 flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            'text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700',
            'dark:text-indigo-500 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}
