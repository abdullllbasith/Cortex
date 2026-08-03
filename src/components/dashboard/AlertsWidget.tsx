'use client'

import { useState } from 'react'
import { Bell, X, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useExecutiveDashboard } from './ExecutiveDashboardProvider'

export function AlertsWidget() {
  const router = useRouter()
  const { data, isLoading } = useExecutiveDashboard()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const alerts = data?.alerts.filter((a) => !dismissed.has(a.id)) ?? []

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top Alerts</h2>
          {alerts.length > 0 && (
            <Badge variant="danger" size="sm">{alerts.length}</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push('/alerts')}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-1.5">
              <Skeleton height="12px" width="w-2/3" className="rounded" />
              <Skeleton height="10px" width="w-1/4" className="rounded" />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">All clear ✓</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3',
                'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',
              )}
            >
              <Badge variant={alert.severity} size="sm" className="mt-0.5 shrink-0">
                {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {alert.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{alert.time}</p>
              </div>
              <button
                type="button"
                aria-label={`Dismiss alert: ${alert.title}`}
                onClick={() => setDismissed((s) => new Set([...s, alert.id]))}
                className="shrink-0 rounded p-0.5 text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
