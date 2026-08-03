import type { AgentType as PrismaAgentType } from '@prisma/client'

export type AgentTypeKey = 'finance' | 'sales' | 'inventory' | 'operations' | 'executive'

export const AGENT_TYPE_MAP: Record<AgentTypeKey, PrismaAgentType> = {
  finance: 'FINANCE',
  sales: 'SALES',
  inventory: 'INVENTORY',
  operations: 'OPERATIONS',
  executive: 'EXECUTIVE',
}

export const PRISMA_TO_AGENT_KEY: Record<PrismaAgentType, AgentTypeKey> = {
  FINANCE: 'finance',
  SALES: 'sales',
  INVENTORY: 'inventory',
  OPERATIONS: 'operations',
  EXECUTIVE: 'executive',
}

export interface AgentToolDefinition {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

export interface AgentThought {
  reasoning: string
  plannedTool?: string
  plannedInput?: Record<string, unknown>
  observation?: string
  iteration: number
}

export interface AgentAction {
  tool: string
  input: Record<string, unknown>
  result?: unknown
  error?: string
  success: boolean
  durationMs?: number
}

export interface AgentResponse<TOutput = unknown> {
  answer: string
  output?: TOutput
  thoughts: AgentThought[]
  actions: AgentAction[]
  attributions?: AgentAttribution[]
  metadata?: Record<string, unknown>
}

export interface AgentAttribution {
  agentType: AgentTypeKey
  agentId: string
  summary: string
}

export interface AgentTaskInput {
  task: string
  userId: string
  permissions?: string[]
  context?: Record<string, unknown>
  taskId?: string
}

export interface AgentTaskStep {
  type: 'thought' | 'action' | 'observation' | 'response'
  agentType: AgentTypeKey
  agentId: string
  content: string
  data?: Record<string, unknown>
  timestamp: string
}

export interface AgentStatusInfo {
  agentType: AgentTypeKey
  agentId: string
  status: 'active' | 'idle' | 'processing' | 'error'
  tasksCompletedToday: number
  lastActivityAt: string | null
  currentTaskId?: string
}

export interface OrchestratorResult {
  taskId: string
  response: AgentResponse
  primaryAgent: AgentTypeKey
  involvedAgents: AgentTypeKey[]
}
