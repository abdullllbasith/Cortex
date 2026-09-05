'use client'

import { Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, Button } from '@/components/ui'

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
  onClearTask?: (taskId: string) => void | Promise<void>
  onClearCompleted?: () => void | Promise<void>
  clearing?: boolean
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

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'DEAD_LETTER'])

/** Active queue items first; keep recent terminal results visible so failures don't vanish. */
const QUEUE_VISIBLE_STATUSES = new Set([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
])

function isTerminal(status: string) {
  return TERMINAL_STATUSES.has(status)
}

export function TaskQueue({
  tasks,
  className,
  onClearTask,
  onClearCompleted,
  clearing = false,
}: TaskQueueProps) {
  const completedCount = tasks.filter((t) => isTerminal(t.status)).length

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onClearCompleted && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={clearing || completedCount === 0}
            onClick={() => void onClearCompleted()}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear completed ({completedCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {LANES.map((lane) => {
          const laneTasks = tasks
            .filter((t) => t.priority === lane.priority && QUEUE_VISIBLE_STATUSES.has(t.status))
            .sort((a, b) => {
              const active = (s: string) => (s === 'PENDING' || s === 'PROCESSING' ? 0 : 1)
              const byActive = active(a.status) - active(b.status)
              if (byActive !== 0) return byActive
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
            .slice(0, 40)

          return (
            <div
              key={lane.priority}
              className={cn(
                'flex max-h-[22rem] flex-col rounded-xl border bg-slate-50/50 p-3 dark:bg-slate-900/50',
                lane.color,
              )}
            >
              <div className="mb-3 flex shrink-0 items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {lane.label}
                </h3>
                <Badge size="sm">{laneTasks.length}</Badge>
              </div>

              <div className="min-h-[7.5rem] flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {laneTasks.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">No tasks in queue</p>
                )}
                {laneTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'rounded-lg border bg-white p-3 text-sm dark:bg-slate-800',
                      task.status === 'FAILED' || task.status === 'DEAD_LETTER'
                        ? 'border-red-200 dark:border-red-900/60'
                        : task.status === 'COMPLETED'
                          ? 'border-emerald-200 dark:border-emerald-900/60'
                          : 'border-slate-200 dark:border-slate-700',
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge variant={STATUS_COLOR[task.status] ?? 'default'} size="sm">
                        {task.status}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {task.agentType && (
                          <span className="text-xs capitalize text-slate-400">{task.agentType}</span>
                        )}
                        {onClearTask && isTerminal(task.status) && (
                          <button
                            type="button"
                            aria-label="Remove task"
                            title="Remove from queue"
                            disabled={clearing}
                            onClick={() => void onClearTask(task.id)}
                            className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 text-slate-800 dark:text-slate-200">{task.task}</p>
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
    </div>
  )
}
