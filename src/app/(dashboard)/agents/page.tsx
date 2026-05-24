'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { AgentCard, AgentThoughtStream, TaskQueue } from '@/components/agents'
import { QueryProvider } from '@/providers/QueryProvider'
import { getSessionSnapshot } from '@/store/sessionStore'
import type { AgentStatusInfo, AgentTaskStep, AgentTypeKey } from '@/lib/agents/core/types'
import { toast } from '@/components/ui'
import { useState } from 'react'

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface StatusData {
  agents: AgentStatusInfo[]
  queue: { waiting: number; active: number; completed: number; failed: number; available: boolean }
  metrics: { avgProcessingMs: number; totalTasksToday: number; activeTasks: number }
}

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

async function fetchWithAuth<T>(path: string): Promise<T> {
  const session = getSessionSnapshot()
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const res = await fetch(`${base}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.tenant?.id ? { 'x-tenant-id': session.tenant.id } : {}),
    },
  })
  if (!res.ok) throw new Error('Request failed')
  const json = await res.json() as ApiResponse<T>
  return json.data
}

async function postTask(task: string, preferredAgent?: AgentTypeKey) {
  const session = getSessionSnapshot()
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const res = await fetch(`${base}/agents/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.tenant?.id ? { 'x-tenant-id': session.tenant.id } : {}),
    },
    body: JSON.stringify({ task, preferredAgent, priority: 'HIGH' }),
  })
  if (!res.ok) throw new Error('Task submission failed')
  return (await res.json()) as ApiResponse<{ taskId: string; status: string; result?: { answer: string } }>
}

function buildSparkline(agent: AgentStatusInfo): Array<{ hour: number; count: number }> {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: Math.max(0, agent.tasksCompletedToday - Math.abs(12 - hour) + Math.floor(Math.random() * 2)),
  }))
}

function AgentsControlCenter() {
  const queryClient = useQueryClient()
  const [recentSteps, setRecentSteps] = useState<AgentTaskStep[]>([])
  const [invoking, setInvoking] = useState<AgentTypeKey | null>(null)

  const { data: status } = useQuery({
    queryKey: ['agents-status'],
    queryFn: () => fetchWithAuth<StatusData>('/agents/status'),
    refetchInterval: 2000,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['agents-tasks'],
    queryFn: () => fetchWithAuth<QueueTask[]>('/agents/tasks'),
    refetchInterval: 2000,
  })

  const invokeAgent = async (agentType: AgentTypeKey, task: string) => {
    setInvoking(agentType)
    try {
      const result = await postTask(task, agentType)
      toast.success(result.data.status === 'completed' ? 'Task completed' : 'Task queued')

      if (result.data.result?.answer) {
        setRecentSteps((prev) => [
          ...prev,
          {
            type: 'response',
            agentType,
            agentId: `${agentType}-agent`,
            content: result.data.result!.answer,
            timestamp: new Date().toISOString(),
          },
        ])
      }

      queryClient.invalidateQueries({ queryKey: ['agents-status'] })
      queryClient.invalidateQueries({ queryKey: ['agents-tasks'] })
    } catch {
      toast.error('Failed to run agent task')
    } finally {
      setInvoking(null)
    }
  }

  const agents = status?.agents ?? []

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Multi-Agent Control Center"
        subtitle="Monitor, invoke, and coordinate specialized AI agents"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents' }]}
      />

      <ResponsiveContainer className="flex-1 py-6 space-y-8">
        {status?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Tasks Today', value: status.metrics.totalTasksToday },
              { label: 'Active Now', value: status.metrics.activeTasks },
              { label: 'Queue Waiting', value: status.queue.waiting },
              { label: 'Avg Response', value: `${status.metrics.avgProcessingMs}ms` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs text-slate-400">{m.label}</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="page-section-title mb-3">Agent Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.agentType}
                agent={agent}
                activitySparkline={buildSparkline(agent)}
                onInvoke={invokeAgent}
                isInvoking={invoking === agent.agentType}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="page-section-title mb-3">Task Queue</h2>
          <TaskQueue tasks={tasks} />
        </section>

        <section>
          <h2 className="page-section-title mb-3">Live Thought Stream</h2>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 max-h-96 overflow-y-auto">
            <AgentThoughtStream steps={recentSteps} />
          </div>
        </section>
      </ResponsiveContainer>
    </div>
  )
}

export default function AgentsPage() {
  return (
    <QueryProvider>
      <AgentsControlCenter />
    </QueryProvider>
  )
}
