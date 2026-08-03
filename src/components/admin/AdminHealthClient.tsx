'use client'

import useSWR from 'swr'
import { PageHeader, Card, CardBody } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

export function AdminHealthClient() {
  const { data: tech, isLoading } = useSWR<{
    avgApiResponseTimeMs: number
    errorRate: number
    queueDepths: {
      agentTasksPending: number
      agentTasksProcessing: number
      workflowExecutionsPending: number
      workflowExecutionsRunning: number
    }
    webhookSuccessRate: number
    sampledRequests: number
  }>('/admin/metrics/tech', swrFetcher)

  const metrics = [
    { label: 'API Latency (avg)', value: tech ? `${tech.avgApiResponseTimeMs}ms` : '—' },
    { label: 'Error Rate', value: tech ? `${tech.errorRate}%` : '—' },
    { label: 'Webhook Success', value: tech ? `${tech.webhookSuccessRate}%` : '—' },
    { label: 'Sampled Requests (24h)', value: tech ? String(tech.sampledRequests) : '—' },
    { label: 'Agent Tasks Pending', value: tech ? String(tech.queueDepths.agentTasksPending) : '—' },
    { label: 'Agent Tasks Processing', value: tech ? String(tech.queueDepths.agentTasksProcessing) : '—' },
    { label: 'Workflows Pending', value: tech ? String(tech.queueDepths.workflowExecutionsPending) : '—' },
    { label: 'Workflows Running', value: tech ? String(tech.queueDepths.workflowExecutionsRunning) : '—' },
  ]

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Platform Health"
        subtitle="Infrastructure and queue monitoring"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Platform Health' }]}
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading metrics…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardBody className="p-5">
                  <p className="text-sm text-slate-500">{m.label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{m.value}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
