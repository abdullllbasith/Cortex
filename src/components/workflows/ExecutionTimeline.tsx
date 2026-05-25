'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, Clock, XCircle, RefreshCw } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api/apiClient'

interface NodeExecution {
  id: string
  nodeId: string
  nodeType: string
  status: string
  startedAt: string | null
  completedAt: string | null
  outputData: Record<string, unknown>
  errorMessage: string | null
  retryCount: number
}

interface Execution {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  nodeExecutions: NodeExecution[]
}

interface ExecutionTimelineProps {
  executions: Execution[]
  onRefresh?: () => void
}

function normalizeStatus(status: string): 'success' | 'failed' | 'running' {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'success') return 'success'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  return 'running'
}

function statusIcon(status: string) {
  const kind = normalizeStatus(status)
  if (kind === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (kind === 'failed') return <XCircle className="h-4 w-4 text-red-500" />
  return <Clock className="h-4 w-4 text-amber-500" />
}

function statusBadgeVariant(status: string): 'success' | 'danger' | 'warning' {
  const kind = normalizeStatus(status)
  if (kind === 'success') return 'success'
  if (kind === 'failed') return 'danger'
  return 'warning'
}

function slackErrorHint(message: string | null | undefined): string | null {
  if (!message?.includes('channel_not_found')) return null
  return 'Slack could not find that channel. Invite the bot to #sales or switch this node to Email.'
}

function executionSummary(exec: Execution): string | null {
  const nodes = exec.nodeExecutions ?? []
  if (!nodes.length) return null
  const completed = nodes.filter((n) => n.status === 'COMPLETED').length
  const failed = nodes.find((n) => n.status === 'FAILED')
  if (normalizeStatus(exec.status) === 'success') return `${completed}/${nodes.length} steps completed`
  if (failed) {
    return `${completed}/${nodes.length} steps completed · failed at ${failed.nodeId} (${failed.nodeType.replace('action.', '').replace('control.', '')})`
  }
  return `${completed}/${nodes.length} steps completed`
}

export function ExecutionTimeline({ executions, onRefresh }: ExecutionTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function retryNode(execId: string, nodeId: string) {
    setRetrying(`${execId}-${nodeId}`)
    try {
      await apiClient.post(`/workflows/executions/${execId}`, { nodeId })
      onRefresh?.()
    } finally {
      setRetrying(null)
    }
  }

  if (!executions.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">No executions yet</p>
  }

  return (
    <div className="space-y-3">
      {executions.map((exec) => {
        const isOpen = expanded === exec.id
        const duration = exec.startedAt && exec.completedAt
          ? Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)
          : null

        return (
          <div key={exec.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : exec.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {statusIcon(exec.status)}
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium">{exec.id.slice(0, 12)}…</p>
                <p className="text-xs text-slate-500">{exec.startedAt ? new Date(exec.startedAt).toLocaleString() : 'Pending'}</p>
                {executionSummary(exec) && (
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{executionSummary(exec)}</p>
                )}
              </div>
              <Badge variant={statusBadgeVariant(exec.status)} size="sm">
                {exec.status}
              </Badge>
              {duration != null && <span className="text-xs text-slate-400">{duration}s</span>}
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="px-4 py-3 space-y-2 border-t border-slate-100 dark:border-slate-800">
                {exec.errorMessage && (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded space-y-1">
                    <p>{exec.errorMessage}</p>
                    {slackErrorHint(exec.errorMessage) && (
                      <p className="text-red-500/80">{slackErrorHint(exec.errorMessage)}</p>
                    )}
                    {normalizeStatus(exec.status) === 'failed' && (exec.nodeExecutions?.some((n) => n.status === 'COMPLETED')) && (
                      <p className="text-slate-600 dark:text-slate-400">
                        Earlier steps (e.g. email) may still have succeeded before this failure.
                      </p>
                    )}
                  </div>
                )}
                {exec.nodeExecutions?.map((ne) => (
                  <div key={ne.id} className="flex items-start gap-2 text-xs border-l-2 border-slate-200 pl-3 py-1">
                    {statusIcon(ne.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{ne.nodeType} <span className="text-slate-400">({ne.nodeId})</span></p>
                      {ne.errorMessage && <p className="text-red-500 mt-0.5">{ne.errorMessage}</p>}
                      {ne.outputData && Object.keys(ne.outputData).length > 0 && (
                        <pre className="text-[10px] text-slate-500 mt-1 overflow-x-auto max-h-20">{JSON.stringify(ne.outputData, null, 2)}</pre>
                      )}
                    </div>
                    {ne.status === 'FAILED' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={retrying === `${exec.id}-${ne.nodeId}`}
                        onClick={() => retryNode(exec.id, ne.nodeId)}
                      >
                        <RefreshCw className={cn('h-3 w-3', retrying === `${exec.id}-${ne.nodeId}` && 'animate-spin')} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
