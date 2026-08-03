import { SalesOrderStatus } from '@prisma/client'
import { z } from 'zod'
import { emitSalesEventsFromOrderLines } from '@/lib/analytics/salesEventEmitter'
import { prisma } from '@/lib/db/prisma'
import { recordTransaction, releaseReservation } from '@/lib/inventory/stockEngine'
import { parseLineItems } from '@/lib/sales/salesTypes'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  orderIdField: z.string().default('orderId'),
  skipIfAlreadyDelivered: z.boolean().default(true),
})

function toNumber(v: { toNumber(): number } | number): number {
  return typeof v === 'number' ? v : v.toNumber()
}

export const processOrderDeliveryHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.process_order_delivery')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
  if (!orderId) throw nodeError('action.process_order_delivery', 'orderId is required')

  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, tenantId: engineCtx.tenantId },
    include: { contact: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } } },
  })
  if (!order) throw nodeError('action.process_order_delivery', `Order ${orderId} not found`)

  if (cfg.skipIfAlreadyDelivered && order.status === SalesOrderStatus.DELIVERED) {
    ctx.appendLog(`Order ${order.orderNumber} already delivered — skipping stock/sales replay`)
  } else {
    const warehouse = await prisma.warehouse.findFirst({
      where: { tenantId: engineCtx.tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    if (!warehouse) throw nodeError('action.process_order_delivery', 'No active warehouse')

    const items = parseLineItems(order.items)
    const productIds = items.map((i) => i.productId).filter(Boolean) as string[]
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { tenantId: engineCtx.tenantId, id: { in: productIds } },
          select: { id: true, costPrice: true },
        })
      : []
    const costByProduct = new Map(products.map((p) => [p.id, toNumber(p.costPrice)]))
    const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

    for (const item of items) {
      if (!item.productId) continue
      await recordTransaction(engineCtx.tenantId, {
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: warehouse.id,
        transactionType: 'SALE',
        quantity: item.quantity,
        unitCost: costByProduct.get(item.productId) ?? 0,
        referenceType: 'sales_order',
        referenceId: orderId,
        notes: `Workflow order-to-cash: ${order.orderNumber}`,
        performedBy: actorId,
      })
    }

    try {
      await releaseReservation(orderId, engineCtx.tenantId)
    } catch {
      /* optional */
    }

    await emitSalesEventsFromOrderLines({
      tenantId: engineCtx.tenantId,
      orderId,
      contactId: order.contactId,
      channel: 'DIRECT',
      lines: items
        .filter((line) => line.productId)
        .map((line) => ({
          productId: line.productId!,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          unitPrice: line.unitPrice,
          unitCost: costByProduct.get(line.productId!),
        })),
      timestamp: new Date(),
    })

    if (order.status !== SalesOrderStatus.DELIVERED) {
      await prisma.salesOrder.update({
        where: { id: orderId },
        data: { status: SalesOrderStatus.DELIVERED, deliveredAt: new Date() },
      })
    }
    ctx.appendLog(`Recorded SALE transactions and analytics for order ${order.orderNumber}`)
  }

  return {
    outputData: {
      ...inputData,
      orderId,
      orderNumber: order.orderNumber,
      contactId: order.contactId,
      contactEmail: order.contact?.email ?? inputData.contactEmail ?? null,
      contactPhone: order.contact?.phone ?? inputData.contactPhone ?? null,
      contactName: order.contact
        ? `${order.contact.firstName} ${order.contact.lastName}`.trim()
        : (inputData.contactName as string | null) ?? null,
      total: toNumber(order.total),
      currency: order.currency,
      deliveryProcessed: true,
    },
  }
}
