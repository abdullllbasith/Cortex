'use client'

import { Activity } from 'lucide-react'
import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { AgentActivity } from './types'
import { useExecutiveDashboard } from './ExecutiveDashboardProvider'

const typeConfig: Record<AgentActivity['type'], { label: string; variant: 'danger' | 'info' | 'warning' | 'success' }> = {
  alert:     { label: 'Alert',     variant: 'danger'  },
  workflow:  { label: 'Workflow',  variant: 'info'    },
  inventory: { label: 'Inventory', variant: 'warning' },
  analytics: { label: 'Analytics', variant: 'success' },
}

export function AgentActivityFeed() {
  const { data, isLoading } = useExecutiveDashboard()

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Agent Activity
          </h2>
        </div>
        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-label="Live" />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
        {isLoading || !data ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton width="w-7" height="28px" className="rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton height="12px" width="w-1/3" className="rounded" />
                  <Skeleton height="12px" width="w-full" className="rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          data.agentActivity.map((item, i) => {
            const { label, variant } = typeConfig[item.type]
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors',
                  'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                  'animate-fadeIn',
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Badge variant={variant} size="sm" className="mt-0.5 shrink-0">
                  {label}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.agent}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.action}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">{item.time}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
