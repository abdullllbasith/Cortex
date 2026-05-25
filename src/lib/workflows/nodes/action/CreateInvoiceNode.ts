import { z } from 'zod'
import { createFromOrder, createInvoice, sendInvoice } from '@/lib/finance/invoiceService'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  source: z.enum(['order', 'manual']).default('order'),
  orderIdField: z.string().default('orderId'),
  contactIdField: z.string().default('contactId'),
  itemsField: z.string().optional(),
  sendAfterCreate: z.boolean().default(false),
  sendChannels: z.array(z.enum(['email', 'whatsapp'])).default(['email']),
})

export const createInvoiceHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.create_invoice')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

  let invoice
  if (cfg.source === 'order') {
    const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
    if (!orderId) throw nodeError('action.create_invoice', 'orderId is required for order source')
    invoice = await createFromOrder(orderId, engineCtx.tenantId, actorId)
  } else {
    const contactId = String(getByPath(vars, cfg.contactIdField) ?? '').trim()
    const rawItems = getByPath(vars, cfg.itemsField ?? 'items')
    const items = Array.isArray(rawItems) ? rawItems : []
    if (!contactId || !items.length) {
      throw nodeError('action.create_invoice', 'contactId and items are required for manual source')
    }
    invoice = await createInvoice(
      engineCtx.tenantId,
      {
        contactId,
        items: items.map((i: Record<string, unknown>) => ({
          description: String(i.description ?? 'Line item'),
          quantity: Number(i.quantity ?? 1),
          unitPrice: Number(i.unitPrice ?? 0),
          discount: Number(i.discount ?? 0),
          taxRate: Number(i.taxRate ?? 0),
          productId: i.productId ? String(i.productId) : null,
        })),
      },
      actorId,
    )
  }

  const sentChannels: string[] = []
  if (cfg.sendAfterCreate) {
    await sendInvoice(invoice.id, engineCtx.tenantId, actorId)
    sentChannels.push('email')
    if (cfg.sendChannels.includes('whatsapp') && invoice.contact?.phone) {
      sentChannels.push('whatsapp')
    }
  }

  ctx.appendLog(`Invoice ${invoice.invoiceNumber} created${sentChannels.length ? ` and sent via ${sentChannels.join(', ')}` : ''}`)

  return {
    outputData: {
      ...inputData,
      invoice,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.status,
      invoicePaid: invoice.status === 'PAID',
      amountDue: invoice.amountDue,
      contactEmail: invoice.contact?.email ?? null,
      contactPhone: invoice.contact?.phone ?? null,
    },
  }
}
