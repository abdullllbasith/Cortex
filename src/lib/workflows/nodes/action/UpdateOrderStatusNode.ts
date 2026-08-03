import { PaymentStatus, SalesOrderStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  orderIdField: z.string().default('orderId'),
  status: z.nativeEnum(SalesOrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
})

export const updateOrderStatusHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.update_order_status')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
  if (!orderId) throw nodeError('action.update_order_status', 'orderId is required')
  if (!cfg.status && !cfg.paymentStatus) {
    throw nodeError('action.update_order_status', 'status or paymentStatus is required')
  }

  const updated = await prisma.salesOrder.updateMany({
    where: { id: orderId, tenantId: engineCtx.tenantId },
    data: {
      ...(cfg.status && { status: cfg.status }),
      ...(cfg.paymentStatus && { paymentStatus: cfg.paymentStatus }),
    },
  })
  if (updated.count === 0) throw nodeError('action.update_order_status', `Order ${orderId} not found`)

  ctx.appendLog(
    `Order ${orderId} updated${cfg.status ? ` status=${cfg.status}` : ''}${cfg.paymentStatus ? ` paymentStatus=${cfg.paymentStatus}` : ''}`,
  )
  return {
    outputData: {
      ...inputData,
      orderId,
      ...(cfg.status && { orderStatus: cfg.status }),
      ...(cfg.paymentStatus && { orderPaymentStatus: cfg.paymentStatus }),
    },
  }
}
