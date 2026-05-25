import type { ActionParameter, ActionTaken } from '../types'

export function actionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function completedAction(
  partial: Omit<ActionTaken, 'id' | 'status'> & { description: string; type: string },
): ActionTaken {
  return { id: actionId(), status: 'completed', ...partial }
}

export function failedAction(description: string, type: string): ActionTaken {
  return { id: actionId(), type, description, status: 'failed' }
}

export function confirmationAction(params: {
  type: string
  description: string
  displayTitle: string
  parameters: ActionParameter[]
  executePayload: Record<string, unknown>
  entityType?: string
  entityId?: string
  reversible?: boolean
}): ActionTaken {
  return {
    id: actionId(),
    type: params.type,
    description: params.description,
    displayTitle: params.displayTitle,
    parameters: params.parameters,
    executePayload: params.executePayload,
    entityType: params.entityType,
    entityId: params.entityId,
    reversible: params.reversible,
    status: 'awaiting_confirmation',
    requiresConfirmation: true,
  }
}
