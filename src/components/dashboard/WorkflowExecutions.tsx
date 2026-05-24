'use client'

import { GitBranch, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { WorkflowExecution } from './types'
import { useExecutiveDashboard } from './ExecutiveDashboardProvider'

const statusConfig: Record<
  WorkflowExecution['status'],
  { label: string; variant: 'success' | 'info' | 'danger' }
> = {
  success: { label: 'Done',    variant: 'success' },
  running: { label: 'Running', variant: 'info'    },
  failed:  { label: 'Failed',  variant: 'danger'  },
}

export function WorkflowExecutions() {
  const router = useRouter()
  const { data, isLoading } = useExecutiveDashboard()

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Workflows
          </h2>
        </div>
        <button
          type="button"
          onClick={() => router.push('/workflows')}
          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton height="20px" width="w-12" className="rounded-full" />
                <Skeleton height="12px" className="flex-1 rounded" />
                <Skeleton height="12px" width="w-10" className="rounded" />
              </div>
            ))
          : data.recentWorkflows.map((wf) => {
              const { label, variant } = statusConfig[wf.status]
              return (
                <div
                  key={wf.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-default',
                  )}
                >
                  <Badge variant={variant} size="sm" className="shrink-0">
                    {label}
                  </Badge>
                  <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {wf.name}
                  </span>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-mono text-slate-400">{wf.duration}</p>
                    <p className="text-[10px] text-slate-400">{wf.time}</p>
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
