'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Agent, AgentLog, ListParams, PaginatedResponse } from '@/lib/api/types'

export function useAgents() {
  return useSWR<Agent[]>(
    queryKeys.agents.list(),
    () => apiClient.get<Agent[]>('/agents'),
  )
}

export function useAgentLogs(agentType: string, params?: ListParams) {
  return useSWR<PaginatedResponse<AgentLog>>(
    queryKeys.agents.logs(agentType, params),
    () => apiClient.get<PaginatedResponse<AgentLog>>(`/agents/${agentType}/logs`, { params }),
  )
}
