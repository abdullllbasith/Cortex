import { FinancePaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { createPO } from '@/lib/inventory/purchaseOrderService'
import { generateReorderSuggestions } from '@/lib/inventory/reorderService'
import { getStockBalance, recordTransaction } from '@/lib/inventory/stockEngine'
import { createActivity } from '@/lib/crm/activityService'
import { scheduleFollowUp } from '@/lib/crm/contactService'
import { moveDeal, parseStages } from '@/lib/crm/pipelineService'
import { recordPayment as recordInvoicePayment } from '@/lib/finance/invoiceService'
import { getProfitAndLoss } from '@/lib/finance/reportingService'
import type { ActionTaken } from '../types'

export async function executeConfirmedAction(
  tenantId: string,
  userId: string,
  action: ActionTaken,
): Promise<ActionTaken> {
  const payload = action.executePayload ?? {}
  const type = action.type

  try {
    switch (type) {
      case 'inventory.update_stock': {
        const { productId, warehouseId, quantity, reason } = payload as {
          productId: string
          warehouseId: string
          quantity: number
          reason?: string
        }
        const result = await recordTransaction(tenantId, {
          productId,
          warehouseId,
          transactionType: 'ADJUSTMENT',
          quantity,
          referenceType: 'ASSISTANT_ADJUSTMENT',
          referenceId: `asst-${Date.now()}`,
          notes: reason ?? 'Assistant stock adjustment',
          performedBy: userId,
        })
        const balances = await getStockBalance(tenantId, productId, warehouseId)
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          description: `Stock updated: ${quantity > 0 ? '+' : ''}${quantity} units (now ${result.totalOnHand} on hand)`,
          resultMessage: `New on-hand total: ${result.totalOnHand}`,
          recordLink: `/inventory/products/${productId}`,
          undoPayload: { productId, warehouseId, quantity: -quantity, ledgerId: result.ledgerId },
          reversible: true,
        }
      }

      case 'inventory.create_po': {
        const { supplierId, warehouseId, items } = payload as {
          supplierId: string
          warehouseId: string
          items: Array<{ productId: string; quantity: number; unitCost: number; taxRate?: number }>
        }
        const po = await createPO(
          tenantId,
          {
            supplierId,
            warehouseId,
            items: items.map((i) => ({ ...i, taxRate: i.taxRate ?? 0 })),
            shippingCost: 0,
            currency: 'USD',
          },
          userId,
        )
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: po.id,
          entityType: 'purchase_order',
          description: `Created purchase order ${po.poNumber}`,
          resultMessage: `PO ${po.poNumber} is in draft status`,
          recordLink: `/inventory/purchase-orders/${po.id}`,
        }
      }

      case 'finance.record_payment': {
        const { invoiceId, amount, paymentMethod } = payload as {
          invoiceId: string
          amount: number
          paymentMethod: string
        }
        const normalized = paymentMethod.toUpperCase().replace(/\s+/g, '_')
        const method =
          (FinancePaymentMethod[normalized as keyof typeof FinancePaymentMethod] as FinancePaymentMethod) ??
          FinancePaymentMethod.BANK_TRANSFER
        const invoice = await recordInvoicePayment(
          invoiceId,
          tenantId,
          { amount, paymentMethod: method, paymentDate: new Date().toISOString() },
          userId,
        )
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: invoiceId,
          entityType: 'invoice',
          description: `Recorded $${amount.toLocaleString()} payment on ${invoice?.invoiceNumber ?? invoiceId}`,
          resultMessage: `Invoice status: ${invoice?.status ?? 'updated'}`,
          recordLink: `/finance/invoices/${invoiceId}`,
        }
      }

      case 'crm.log_call': {
        const { contactId, subject, notes } = payload as {
          contactId: string
          subject?: string
          notes?: string
        }
        const activity = await createActivity(
          tenantId,
          {
            type: 'CALL',
            contactId,
            subject: subject ?? 'Call logged via assistant',
            description: notes ?? null,
            isCompleted: true,
            completedAt: new Date().toISOString(),
          },
          userId,
        )
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: activity.id,
          entityType: 'activity',
          description: `Logged call for contact`,
          resultMessage: activity.subject,
          recordLink: `/crm/contacts/${contactId}`,
        }
      }

      case 'crm.schedule_followup': {
        const { contactId, dateIso, assignTo } = payload as {
          contactId: string
          dateIso: string
          assignTo?: string
        }
        await scheduleFollowUp(tenantId, contactId, new Date(dateIso), assignTo, userId)
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: contactId,
          entityType: 'contact',
          description: `Scheduled follow-up on ${new Date(dateIso).toLocaleDateString()}`,
          recordLink: `/crm/contacts/${contactId}`,
        }
      }

      case 'crm.move_deal': {
        const { dealId, stageId } = payload as { dealId: string; stageId: string }
        const updated = await moveDeal(dealId, stageId, tenantId, userId)
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: dealId,
          entityType: 'deal',
          description: `Moved deal "${updated.title}" to new stage`,
          recordLink: `/crm/deals/${dealId}`,
        }
      }

      case 'sales.create_quote': {
        const { contactId, lineItems } = payload as {
          contactId: string
          lineItems: Array<Record<string, unknown>>
        }
        const { createQuote } = await import('@/lib/sales/quoteService')
        const quote = await createQuote(tenantId, { contactId, items: lineItems }, userId)
        return {
          ...action,
          status: 'completed',
          requiresConfirmation: false,
          entityId: quote?.id,
          entityType: 'quote',
          description: `Created quote ${quote?.quoteNumber ?? ''}`,
          recordLink: quote?.id ? `/sales/quotes/${quote.id}` : undefined,
        }
      }

      default:
        return {
          ...action,
          status: 'failed',
          requiresConfirmation: false,
          resultMessage: `Unsupported action type: ${type}`,
        }
    }
  } catch (err) {
    return {
      ...action,
      status: 'failed',
      requiresConfirmation: false,
      resultMessage: err instanceof Error ? err.message : 'Action failed',
    }
  }
}

/** Read-only action helpers used from confirm path or handlers */
export async function fetchReorderStatus(tenantId: string) {
  return generateReorderSuggestions(tenantId, 'all')
}

export async function fetchMonthlyProfit(tenantId: string) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return getProfitAndLoss(
    tenantId,
    start.toISOString().slice(0, 10),
    now.toISOString().slice(0, 10),
  )
}

export async function findDealByTitle(tenantId: string, title: string) {
  return prisma.crmDeal.findFirst({
    where: { tenantId, title: { contains: title, mode: 'insensitive' }, status: 'OPEN' },
    include: { pipeline: { select: { stages: true } } },
  })
}

export async function resolveStageId(
  stagesJson: unknown,
  stageName: string,
): Promise<string | null> {
  const stages = parseStages(stagesJson)
  const match = stages.find((s) => s.name.toLowerCase() === stageName.toLowerCase())
  return match?.id ?? null
}
