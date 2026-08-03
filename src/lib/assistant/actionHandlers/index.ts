import type { IntentClassification } from '../types'
import { handleSalesAction, undoSalesAction } from './salesAction'
import { handleInventoryAction, undoInventoryAction } from './inventoryAction'
import { handleFinanceAction, undoFinanceAction } from './financeAction'
import { handleHrAction, undoHrAction } from './hrAction'
import { handleCrmAction, undoCrmAction } from './crmAction'
import type { ActionTaken } from '../types'

export async function routeActionHandler(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const lower = message.toLowerCase()

  if (
    /\b(customer|client|lead|deal|pipeline|contact|follow[- ]?up|call)\b/i.test(lower) &&
    (classification.handler === 'crm' ||
      classification.handler === 'sales' ||
      !classification.handler)
  ) {
    const crm = await handleCrmAction(tenantId, userId, message, classification)
    if (crm.length) return crm
  }

  switch (classification.handler) {
    case 'inventory':
      return handleInventoryAction(tenantId, userId, message, classification)
    case 'sales':
      return handleSalesAction(tenantId, userId, message, classification)
    case 'finance':
      return handleFinanceAction(tenantId, userId, message, classification)
    case 'hr':
      return handleHrAction(tenantId, userId, message, classification)
    case 'crm':
      return handleCrmAction(tenantId, userId, message, classification)
    default:
      if (classification.intent === 'REPORT') {
        const finance = await handleFinanceAction(tenantId, userId, message, classification)
        if (finance.length) return finance
        return handleSalesAction(tenantId, userId, message, classification)
      }
      if (/\b(invoice|payment|overdue|profit|revenue|ar)\b/i.test(lower)) {
        return handleFinanceAction(tenantId, userId, message, classification)
      }
      if (/\b(stock|inventory|warehouse|reorder|po)\b/i.test(lower)) {
        return handleInventoryAction(tenantId, userId, message, classification)
      }
      if (classification.intent === 'AUTOMATION') {
        return [
          {
            id: `act_${Date.now()}`,
            type: 'automation.queued',
            description: 'Automation rule queued for configuration in Settings',
            status: 'pending',
          },
        ]
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
    case 'crm':
      return undoCrmAction(tenantId, action)
    default:
      return false
  }
}

export { executeConfirmedAction } from './actionExecutor'
export { handleSalesAction } from './salesAction'
export { handleInventoryAction } from './inventoryAction'
export { handleFinanceAction } from './financeAction'
export { handleHrAction } from './hrAction'
export { handleCrmAction } from './crmAction'
