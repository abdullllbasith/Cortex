'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

interface QueueTask {
  id: string
  task: string
  agentType: string | null
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: string
  userId: string
  createdAt: string
  elapsedMs: number | null
}

interface TaskQueueProps {
  tasks: QueueTask[]
  className?: string
}

const LANES = [
  { priority: 'HIGH' as const, label: 'High Priority', color: 'border-red-200 dark:border-red-900' },
  { priority: 'MEDIUM' as const, label: 'Medium', color: 'border-amber-200 dark:border-amber-900' },
  { priority: 'LOW' as const, label: 'Low / Background', color: 'border-slate-200 dark:border-slate-700' },
]

const STATUS_COLOR: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  DEAD_LETTER: 'danger',
}

/** Active queue items first; keep recent terminal results visible so failures don't vanish. */
const QUEUE_VISIBLE_STATUSES = new Set([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
])

export function TaskQueue({ tasks, className }: TaskQueueProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {LANES.map((lane) => {
        const laneTasks = tasks
          .filter((t) => t.priority === lane.priority && QUEUE_VISIBLE_STATUSES.has(t.status))
          .sort((a, b) => {
            const active = (s: string) => (s === 'PENDING' || s === 'PROCESSING' ? 0 : 1)
            const byActive = active(a.status) - active(b.status)
            if (byActive !== 0) return byActive
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
          .slice(0, 12)

        return (
          <div
            key={lane.priority}
            className={cn('rounded-xl border bg-slate-50/50 dark:bg-slate-900/50 p-3', lane.color)}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lane.label}
              </h3>
              <Badge size="sm">{laneTasks.length}</Badge>
            </div>

            <div className="space-y-2 min-h-[120px]">
              {laneTasks.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No tasks in queue</p>
              )}
              {laneTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'rounded-lg border bg-white dark:bg-slate-800 p-3 text-sm',
                    task.status === 'FAILED' || task.status === 'DEAD_LETTER'
                      ? 'border-red-200 dark:border-red-900/60'
                      : task.status === 'COMPLETED'
                        ? 'border-emerald-200 dark:border-emerald-900/60'
                        : 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Badge variant={STATUS_COLOR[task.status] ?? 'default'} size="sm">
                      {task.status}
                    </Badge>
                    {task.agentType && (
                      <span className="text-xs text-slate-400 capitalize">{task.agentType}</span>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 line-clamp-2 mb-2">{task.task}</p>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{task.userId.slice(0, 12)}</span>
                    <span>
                      {task.status === 'PENDING' && (task.elapsedMs == null || task.elapsedMs < 2_000)
                        ? 'queued'
                        : task.status === 'PROCESSING'
                          ? `running ${Math.max(1, Math.round((task.elapsedMs ?? 0) / 1000))}s`
                          : task.status === 'FAILED' || task.status === 'DEAD_LETTER'
                            ? 'failed'
                            : task.status === 'COMPLETED'
                              ? 'done'
                              : task.elapsedMs != null
                                ? `${Math.round(task.elapsedMs / 1000)}s`
                                : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
