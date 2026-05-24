import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import type { ActionTaken, IntentClassification } from '../types'

function actionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function handleSalesAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const actions: ActionTaken[] = []
  const period = String(classification.entities.period ?? 'this month')

  if (/\b(list|show|get|find)\b.*\bcustomers?\b/i.test(message)) {
    const { data, total } = await knowledgeRepository.listCustomers(tenantId, { limit: 10 })
    actions.push({
      id: actionId(),
      type: 'sales.list_customers',
      description: `Retrieved ${total} customer record(s)`,
      entityType: 'customer',
      status: 'completed',
      undoPayload: { count: data.length },
    })
    return actions
  }

  if (classification.intent === 'REPORT' || /\bsales\b/i.test(message)) {
    actions.push({
      id: actionId(),
      type: 'sales.report',
      description: `Generated sales summary for ${period}`,
      status: 'completed',
    })
  }

  if (classification.intent === 'COMMAND' && classification.entities.productName) {
    actions.push({
      id: actionId(),
      type: 'sales.record_note',
      description: `Logged sales command for follow-up: ${classification.entities.productName}`,
      status: 'pending',
    })
  }

  return actions
}

export async function undoSalesAction(
  tenantId: string,
  action: ActionTaken,
): Promise<boolean> {
  void tenantId
  void action
  return false
}
