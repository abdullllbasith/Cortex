'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Workflow, WorkflowExecution } from '@/lib/api/types'

export function useWorkflows() {
  return useSWR<Workflow[]>(
    queryKeys.workflows.list(),
    () => apiClient.get<Workflow[]>('/workflows'),
  )
}

export function useWorkflow(id?: string) {
  return useSWR<Workflow>(
    id ? queryKeys.workflows.detail(id) : null,
    () => apiClient.get<Workflow>(`/workflows/${id}`),
  )
}

export function useWorkflowExecutions(id?: string) {
  return useSWR<WorkflowExecution[]>(
    id ? queryKeys.workflows.executions(id) : null,
    () => apiClient.get<WorkflowExecution[]>(`/workflows/${id}/executions`),
  )
}
