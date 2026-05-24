import type { IntentClassification } from '../types'
import { handleSalesAction, undoSalesAction } from './salesAction'
import { handleInventoryAction, undoInventoryAction } from './inventoryAction'
import { handleFinanceAction, undoFinanceAction } from './financeAction'
import { handleHrAction, undoHrAction } from './hrAction'
import type { ActionTaken } from '../types'

export async function routeActionHandler(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  if (classification.intent === 'QUERY') return []

  switch (classification.handler) {
    case 'sales':
      return handleSalesAction(tenantId, userId, message, classification)
    case 'inventory':
      return handleInventoryAction(tenantId, userId, message, classification)
    case 'finance':
      return handleFinanceAction(tenantId, userId, message, classification)
    case 'hr':
      return handleHrAction(tenantId, userId, message, classification)
    default:
      if (classification.intent === 'REPORT') {
        return handleFinanceAction(tenantId, userId, message, classification)
      }
      if (classification.intent === 'FORECAST') {
        return handleSalesAction(tenantId, userId, message, classification)
      }
      if (classification.intent === 'AUTOMATION') {
        return [{
          id: `act_${Date.now()}`,
          type: 'automation.queued',
          description: 'Automation rule queued for configuration in Settings',
          status: 'pending',
        }]
      }
      return []
  }
}

export async function undoAction(
  tenantId: string,
  userId: string,
  action: ActionTaken,
): Promise<boolean> {
  switch (action.type.split('.')[0]) {
    case 'sales':
      return undoSalesAction(tenantId, action)
    case 'inventory':
      return undoInventoryAction(tenantId, userId, action)
    case 'finance':
      return undoFinanceAction(tenantId, action)
    case 'hr':
      return undoHrAction(tenantId, action)
    default:
      return false
  }
}

export { handleSalesAction } from './salesAction'
export { handleInventoryAction } from './inventoryAction'
export { handleFinanceAction } from './financeAction'
export { handleHrAction } from './hrAction'
