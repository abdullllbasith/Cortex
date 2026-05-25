import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  invoiceIdField: z.string().default('invoiceId'),
})

function toNumber(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : v.toNumber()
}

export const checkInvoicePaymentHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.check_invoice_payment')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const invoiceId = String(getByPath(vars, cfg.invoiceIdField) ?? '').trim()
  if (!invoiceId) throw nodeError('action.check_invoice_payment', 'invoiceId is required')

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: engineCtx.tenantId },
    include: { contact: { select: { email: true, phone: true, firstName: true, lastName: true } } },
  })
  if (!invoice) throw nodeError('action.check_invoice_payment', `Invoice ${invoiceId} not found`)

  const amountDue = toNumber(invoice.amountDue)
  const invoicePaid = invoice.status === 'PAID' || amountDue <= 0

  ctx.appendLog(
    `Invoice ${invoice.invoiceNumber}: status=${invoice.status}, due=$${amountDue}, paid=${invoicePaid}`,
  )

  return {
    outputData: {
      ...inputData,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.status,
      invoicePaid,
      amountDue,
      total: toNumber(invoice.total),
      contactEmail: invoice.contact?.email ?? inputData.contactEmail ?? null,
      contactPhone: invoice.contact?.phone ?? inputData.contactPhone ?? null,
    },
    branch: invoicePaid ? 'false' : 'true',
  }
}
