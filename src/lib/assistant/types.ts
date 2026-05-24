import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

export type AssistantIntent = 'QUERY' | 'COMMAND' | 'REPORT' | 'FORECAST' | 'AUTOMATION'

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
  status: 'completed' | 'pending' | 'failed'
}

export interface IntentClassification {
  intent: AssistantIntent
  confidence: number
  entities: Record<string, string | number | boolean>
  handler?: 'sales' | 'inventory' | 'finance' | 'hr'
}

export interface ConversationEngineInput {
  tenantId: string
  userId: string
  userMessage: string
  conversationHistory: ConversationTurn[]
  permissions?: string[]
  userRole?: string
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
