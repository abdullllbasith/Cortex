'use client'

import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader, Badge, Button, Input, Textarea } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { AgentThoughtStream } from '@/components/agents'
import { QueryProvider } from '@/providers/QueryProvider'
import { getSessionSnapshot } from '@/store/sessionStore'
import type { AgentTypeKey, AgentTaskStep } from '@/lib/agents/core/types'
import { toast } from '@/components/ui'
import { useState } from 'react'

const VALID_TYPES: AgentTypeKey[] = ['finance', 'sales', 'inventory', 'operations', 'executive']

interface ApiResponse<T> {
  success: boolean
  data: T
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

async function postWithAuth<T>(path: string, body: unknown): Promise<T> {
  const session = getSessionSnapshot()
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.tenant?.id ? { 'x-tenant-id': session.tenant.id } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Request failed')
  const json = await res.json() as ApiResponse<T>
  return json.data
}

function AgentDetailContent() {
  const params = useParams()
  const agentType = params.agentType as AgentTypeKey
  const queryClient = useQueryClient()
  const [memoryKey, setMemoryKey] = useState('')
  const [memoryValue, setMemoryValue] = useState('')

  const isValid = VALID_TYPES.includes(agentType)
  const label = agentType?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Agent'

  const { data: logsData } = useQuery({
    queryKey: ['agent-logs', agentType],
    queryFn: () => fetchWithAuth<{ id: string; action: string; status: string; createdAt: string; durationMs: number | null; result: unknown }[]>(
      `/agents/logs?agentType=${agentType}&limit=50`,
    ),
    enabled: isValid,
    refetchInterval: 2000,
  })

  const { data: memories = [] } = useQuery({
    queryKey: ['agent-memory', agentType],
    queryFn: () => fetchWithAuth<Array<{ key: string; value: unknown; expiresAt: string | null }>>(
      `/agents/memory?agentType=${agentType}`,
    ),
    enabled: isValid,
    refetchInterval: 2000,
  })

  const { data: statusData } = useQuery({
    queryKey: ['agents-status'],
    queryFn: () => fetchWithAuth<{ agents: Array<{ agentType: AgentTypeKey; status: string; tasksCompletedToday: number }> }>(
      '/agents/status',
    ),
    refetchInterval: 2000,
  })

  const injectMemory = useMutation({
    mutationFn: (payload: { key: string; value: string }) =>
      postWithAuth('/agents/memory', {
        agentType,
        key: payload.key,
        value: { instruction: payload.value, injectedAt: new Date().toISOString() },
        ttlSeconds: 86400,
      }),
    onSuccess: () => {
      toast.success('Memory injected')
      queryClient.invalidateQueries({ queryKey: ['agent-memory', agentType] })
      setMemoryKey('')
      setMemoryValue('')
    },
    onError: () => toast.error('Failed to inject memory'),
  })

  const agentStatus = statusData?.agents.find((a) => a.agentType === agentType)
  const logs = Array.isArray(logsData) ? logsData : (logsData as unknown as { data?: typeof logsData }) ?? []

  const successCount = (Array.isArray(logs) ? logs : []).filter((l: { status: string }) => l.status === 'SUCCESS').length
  const totalCount = Array.isArray(logs) ? logs.length : 0
  const successRate = totalCount ? Math.round((successCount / totalCount) * 100) : 100

  const thoughtSteps: AgentTaskStep[] = (Array.isArray(logs) ? logs : []).slice(0, 10).map((log: {
    action: string
    status: string
    createdAt: string
    result: unknown
  }) => ({
    type: log.status === 'SUCCESS' ? 'action' as const : 'observation' as const,
    agentType,
    agentId: `${agentType}-agent`,
    content: `${log.action}: ${log.status}`,
    data: log.result as Record<string, unknown>,
    timestamp: log.createdAt,
  }))

  if (!isValid) {
    return <div className="p-6 text-red-500">Invalid agent type</div>
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${label} Agent`}
        subtitle="Activity log, performance metrics, and memory management"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Agents', href: '/agents' },
          { label },
        ]}
        actions={
          <Badge variant={agentStatus?.status === 'processing' ? 'info' : 'success'}>
            {agentStatus?.status ?? 'idle'}
          </Badge>
        }
      />

      <ResponsiveContainer className="flex-1 py-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Tasks Today', value: agentStatus?.tasksCompletedToday ?? 0 },
            { label: 'Success Rate', value: `${successRate}%` },
            { label: 'Memory Entries', value: memories.length },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="text-2xl font-semibold">{m.value}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
          <AgentThoughtStream steps={thoughtSteps} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Agent Memory</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {memories.length === 0 && (
                <p className="p-4 text-sm text-slate-400">No stored memories</p>
              )}
              {memories.map((m) => (
                <div key={m.key} className="p-3 text-sm">
                  <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{m.key}</p>
                  <pre className="text-xs text-slate-600 dark:text-slate-400 mt-1 overflow-x-auto">
                    {JSON.stringify(m.value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Manual Override — Inject Memory</h2>
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
              <Input
                placeholder="Memory key (e.g. priority_focus)"
                value={memoryKey}
                onChange={(e) => setMemoryKey(e.target.value)}
              />
              <Textarea
                placeholder="Instruction to inject into agent memory…"
                value={memoryValue}
                onChange={(e) => setMemoryValue(e.target.value)}
                rows={4}
              />
              <Button
                onClick={() => injectMemory.mutate({ key: memoryKey, value: memoryValue })}
                disabled={!memoryKey.trim() || !memoryValue.trim() || injectMemory.isPending}
                loading={injectMemory.isPending}
              >
                Inject into Memory
              </Button>
            </div>
          </div>
        </section>
      </ResponsiveContainer>
    </div>
  )
}

export default function AgentTypePage() {
  return (
    <QueryProvider>
      <AgentDetailContent />
    </QueryProvider>
  )
}
