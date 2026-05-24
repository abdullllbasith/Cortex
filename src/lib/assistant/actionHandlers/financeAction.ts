import { prisma } from '@/lib/db/prisma'
import type { ActionTaken, IntentClassification } from '../types'

function actionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function handleFinanceAction(
  tenantId: string,
  _userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const actions: ActionTaken[] = []
  const period = String(classification.entities.period ?? 'this month')

  if (/\b(revenue|profit|margin|cash flow|financial)\b/i.test(message)) {
    const productCount = await prisma.product.count({ where: { tenantId } })
    const customerCount = await prisma.customer.count({ where: { tenantId } })

    actions.push({
      id: actionId(),
      type: 'finance.summary',
      description: `Financial overview for ${period}: ${customerCount} customers, ${productCount} products in catalog`,
      status: 'completed',
      undoPayload: { period, productCount, customerCount },
    })
  }

  if (classification.entities.amount) {
    actions.push({
      id: actionId(),
      type: 'finance.amount_reference',
      description: `Referenced amount $${classification.entities.amount} in financial context`,
      status: 'completed',
    })
  }

  if (/\binvoice\b/i.test(message) && classification.intent === 'COMMAND') {
    actions.push({
      id: actionId(),
      type: 'finance.invoice_draft',
      description: 'Invoice draft queued for review (requires approval workflow)',
      status: 'pending',
    })
  }

  return actions
}

export async function undoFinanceAction(
  _tenantId: string,
  _action: ActionTaken,
): Promise<boolean> {
  return false
}
