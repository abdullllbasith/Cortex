import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

export type AssistantIntent = 'QUERY' | 'COMMAND' | 'REPORT' | 'FORECAST' | 'AUTOMATION'

export type ActionStatus = 'completed' | 'pending' | 'failed' | 'awaiting_confirmation' | 'cancelled'

export interface ActionParameter {
  label: string
  value: string
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ActionTaken {
  id: string
  type: string
  description: string
  entityType?: string
  entityId?: string
  reversible?: boolean
  undoPayload?: Record<string, unknown>
  status: ActionStatus
  /** When true, user must confirm before executePayload runs */
  requiresConfirmation?: boolean
  /** Human-readable confirmation title */
  displayTitle?: string
  parameters?: ActionParameter[]
  /** Payload passed to executeConfirmedAction on confirm */
  executePayload?: Record<string, unknown>
  /** Link to created record after success */
  recordLink?: string
  resultMessage?: string
}

export interface IntentClassification {
  intent: AssistantIntent
  confidence: number
  entities: Record<string, string | number | boolean>
  handler?: 'sales' | 'inventory' | 'finance' | 'hr' | 'crm'
}

export interface ConversationEngineInput {
  tenantId: string
  userId: string
  userMessage: string
  conversationHistory: ConversationTurn[]
  permissions?: string[]
  userRole?: string
  userName?: string
  tenantName?: string
  sessionId?: string
}

export interface ConversationEngineResult {
  assistantMessage: string
  sourcesUsed: SemanticSearchResult[]
  actionsTaken: ActionTaken[]
  suggestedFollowUps: string[]
  intent?: IntentClassification
}

export interface StreamChunk {
  type: 'token' | 'metadata' | 'error' | 'done'
  content?: string
  metadata?: Partial<ConversationEngineResult>
}
