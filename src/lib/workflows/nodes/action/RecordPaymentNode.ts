import { FinancePaymentMethod, PaymentStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { recordPayment as recordBillPayment } from '@/lib/finance/billService'
import { getInvoice, recordPayment as recordInvoicePayment } from '@/lib/finance/invoiceService'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  mode: z.enum(['record', 'check']).default('record'),
  targetType: z.enum(['invoice', 'bill']).default('invoice'),
  invoiceIdField: z.string().default('invoiceId'),
  billIdField: z.string().default('billId'),
  amountField: z.string().default('amount'),
  methodField: z.string().default('paymentMethod'),
  defaultMethod: z.nativeEnum(FinancePaymentMethod).default(FinancePaymentMethod.BANK_TRANSFER),
  updateOrderStatus: z.nativeEnum(PaymentStatus).optional(),
  orderIdField: z.string().default('orderId'),
})

export const recordPaymentHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.record_payment')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

  if (cfg.mode === 'check') {
    const invoiceId = String(getByPath(vars, cfg.invoiceIdField) ?? '').trim()
    if (!invoiceId) throw nodeError('action.record_payment', 'invoiceId required for check mode')
    const invoice = await getInvoice(engineCtx.tenantId, invoiceId)
    const paid = invoice.status === 'PAID' || invoice.amountDue <= 0
    ctx.appendLog(`Invoice ${invoice.invoiceNumber} payment check: ${paid ? 'paid' : 'unpaid'}`)
    return {
      outputData: {
        ...inputData,
        invoice,
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        invoicePaid: paid,
        amountDue: invoice.amountDue,
      },
      branch: paid ? 'true' : 'false',
    }
  }

  if (cfg.targetType === 'bill') {
    const billId = String(getByPath(vars, cfg.billIdField) ?? '').trim()
    const amount = Number(getByPath(vars, cfg.amountField) ?? 0)
    if (!billId || amount <= 0) throw nodeError('action.record_payment', 'billId and positive amount required')
    const methodRaw = String(getByPath(vars, cfg.methodField) ?? cfg.defaultMethod)
    const paymentMethod =
      FinancePaymentMethod[methodRaw as keyof typeof FinancePaymentMethod] ?? cfg.defaultMethod
    const payment = await recordBillPayment(
      billId,
      engineCtx.tenantId,
      { amount, paymentMethod, paymentDate: new Date().toISOString() },
      actorId,
    )
    ctx.appendLog(`Bill payment recorded: ${amount}`)
    return { outputData: { ...inputData, billPayment: payment, paymentRecorded: true } }
  }

  const invoiceId = String(getByPath(vars, cfg.invoiceIdField) ?? '').trim()
  const amount = Number(getByPath(vars, cfg.amountField) ?? 0)
  if (!invoiceId || amount <= 0) throw nodeError('action.record_payment', 'invoiceId and positive amount required')

  const methodRaw = String(getByPath(vars, cfg.methodField) ?? cfg.defaultMethod)
  const paymentMethod =
    FinancePaymentMethod[methodRaw as keyof typeof FinancePaymentMethod] ?? cfg.defaultMethod

  const payment = await recordInvoicePayment(
    invoiceId,
    engineCtx.tenantId,
    { amount, paymentMethod, paymentDate: new Date().toISOString() },
    actorId,
  )

  if (cfg.updateOrderStatus) {
    const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
    if (orderId) {
      await prisma.salesOrder.updateMany({
        where: { id: orderId, tenantId: engineCtx.tenantId },
        data: { paymentStatus: cfg.updateOrderStatus },
      })
      ctx.appendLog(`Order ${orderId} status updated to ${cfg.updateOrderStatus}`)
    }
  }

  const invoice = await getInvoice(engineCtx.tenantId, invoiceId)
  ctx.appendLog(`Invoice payment recorded: ${amount}`)

  return {
    outputData: {
      ...inputData,
      payment,
      invoice,
      invoiceId: invoice.id,
      invoiceStatus: invoice.status,
      invoicePaid: invoice.status === 'PAID',
      paymentRecorded: true,
    },
  }
}
