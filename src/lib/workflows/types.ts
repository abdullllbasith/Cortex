export interface WorkflowNodeDef {
  id: string
  type: string
  position?: { x: number; y: number }
  data: {
    label?: string
    config?: Record<string, unknown>
  }
}

export interface WorkflowEdgeDef {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface WorkflowDefinitionJSON {
  nodes: WorkflowNodeDef[]
  edges: WorkflowEdgeDef[]
  triggerType?: string
  triggerConfig?: Record<string, unknown>
}

export interface NodeHandlerInput {
  inputData: Record<string, unknown>
  config: Record<string, unknown>
}

export interface NodeHandlerResult {
  outputData: Record<string, unknown>
  branch?: 'true' | 'false' | 'default' | 'body'
  delayMs?: number
  pauseExecution?: boolean
}

export interface WorkflowEngineContext {
  tenantId: string
  workflowDefinitionId: string
  executionId: string
  triggeredBy: string
  variables: Record<string, unknown>
  logs: string[]
}

export type NodeHandler = (
  input: NodeHandlerInput,
  ctx: WorkflowEngineContext,
) => Promise<NodeHandlerResult>

export const WORKFLOW_TIMEOUT_MS = 10 * 60 * 1000
export const NODE_TIMEOUT_MS = 60 * 1000

export const TRIGGER_NODE_TYPES = new Set([
  'trigger.schedule',
  'trigger.event',
  'trigger.webhook',
  'trigger.manual',
])

export const NODE_CATEGORIES = {
  triggers: ['trigger.schedule', 'trigger.event', 'trigger.webhook', 'trigger.manual'],
  actions: ['action.send_notification', 'action.update_record', 'action.generate_document', 'action.ai_decision', 'action.generate_reorder_suggestion', 'action.create_draft_po'],
  control: ['control.condition', 'control.delay', 'control.loop'],
  integrations: ['integration.http_request'],
} as const
