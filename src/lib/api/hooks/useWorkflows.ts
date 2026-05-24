'use client'

import useSWR from 'swr'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'

export interface WorkflowDetail {
  id: string
  name: string
  description: string | null
  triggerType: string
  isActive: boolean
  nodes: unknown[]
  edges: unknown[]
  triggerConfig: Record<string, unknown>
  webhookToken?: string | null
}

export interface WorkflowListItem {
  id: string
  name: string
  description: string | null
  triggerType: string
  isActive: boolean
  status: 'active' | 'draft'
  executionCount: number
  lastExecution: { status: string } | null
  updatedAt: string
}

export interface WorkflowExecutionItem {
  id: string
  workflowId: string
  status: string
  rawStatus?: string
  startedAt: string
  duration?: string
  errorMessage?: string | null
}

export function useWorkflows() {
  return useSWR<WorkflowListItem[]>(
    queryKeys.workflows.list(),
    () => swrFetcher('/workflows'),
  )
}

export function useWorkflow(id?: string) {
  return useSWR<WorkflowDetail>(
    id ? queryKeys.workflows.detail(id) : null,
    () => swrFetcher(`/workflows/${id}`),
  )
}

export function useWorkflowExecutions(id?: string) {
  return useSWR<WorkflowExecutionItem[]>(
    id ? queryKeys.workflows.executions(id) : null,
    () => swrFetcher(`/workflows/${id}/executions`),
    { refreshInterval: 5000 },
  )
}

export function useWorkflowTemplates() {
  return useSWR(
    [...queryKeys.workflows.all, 'templates'],
    () => swrFetcher('/workflows/templates'),
  )
}

export async function saveWorkflow(id: string, data: Partial<WorkflowDetail>) {
  return apiClient.put(`/workflows/${id}`, data)
}

export async function executeWorkflow(id: string, inputData?: Record<string, unknown>) {
  return apiClient.post(`/workflows/${id}/execute`, { inputData })
}
