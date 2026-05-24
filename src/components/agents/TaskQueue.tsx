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

export function TaskQueue({ tasks, className }: TaskQueueProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {LANES.map((lane) => {
        const laneTasks = tasks.filter(
          (t) => t.priority === lane.priority && ['PENDING', 'PROCESSING'].includes(t.status),
        )

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
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm"
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
                      {task.elapsedMs != null
                        ? `${Math.round(task.elapsedMs / 1000)}s`
                        : 'queued'}
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
