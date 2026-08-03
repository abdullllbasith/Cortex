import { StockTransactionType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getStockBalance, recordTransaction, reserveStock } from '@/lib/inventory/stockEngine'
import { parseLineItems } from '@/lib/sales/salesTypes'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  mode: z.enum(['check_availability', 'reserve', 'adjust']).default('adjust'),
  orderIdField: z.string().default('orderId'),
  productIdField: z.string().default('productId'),
  warehouseIdField: z.string().optional(),
  quantityField: z.string().default('quantity'),
  transactionTypeField: z.string().default('transactionType'),
  reasonField: z.string().default('reason'),
})

async function resolveDefaultWarehouseId(tenantId: string): Promise<string> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) throw new Error('No active warehouse configured')
  return warehouse.id
}

export const updateInventoryHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.update_inventory')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

  if (cfg.mode === 'check_availability') {
    const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
    if (!orderId) throw nodeError('action.update_inventory', 'orderId required for check_availability')

    const order = await prisma.salesOrder.findFirst({ where: { id: orderId, tenantId: engineCtx.tenantId } })
    if (!order) throw nodeError('action.update_inventory', `Order ${orderId} not found`)

    const items = parseLineItems(order.items)
    const shortages: Array<{ productId: string; needed: number; available: number }> = []

    for (const item of items) {
      if (!item.productId) continue
      const balances = await getStockBalance(engineCtx.tenantId, item.productId)
      const available = balances.reduce((s, b) => s + b.quantityAvailable, 0)
      if (available < item.quantity) {
        shortages.push({ productId: item.productId, needed: item.quantity, available })
      }
    }

    const stockAvailable = shortages.length === 0
    ctx.appendLog(`Stock check for order ${order.orderNumber}: ${stockAvailable ? 'available' : 'shortage'}`)

    return {
      outputData: {
        ...inputData,
        orderId,
        orderNumber: order.orderNumber,
        stockAvailable,
        stockShortages: shortages,
      },
      branch: stockAvailable ? 'true' : 'false',
    }
  }

  if (cfg.mode === 'reserve') {
    const orderId = String(getByPath(vars, cfg.orderIdField) ?? '').trim()
    if (!orderId) throw nodeError('action.update_inventory', 'orderId required for reserve')

    const order = await prisma.salesOrder.findFirst({ where: { id: orderId, tenantId: engineCtx.tenantId } })
    if (!order) throw nodeError('action.update_inventory', `Order ${orderId} not found`)

    const items = parseLineItems(order.items)
    for (const item of items) {
      if (!item.productId) continue
      await reserveStock(engineCtx.tenantId, item.productId, item.quantity, orderId, {
        variantId: item.variantId,
        performedBy: actorId,
      })
    }

    ctx.appendLog(`Reserved stock for order ${order.orderNumber}`)
    return { outputData: { ...inputData, orderId, stockReserved: true } }
  }

  const productId = String(getByPath(vars, cfg.productIdField) ?? '').trim()
  const quantity = Number(getByPath(vars, cfg.quantityField) ?? 0)
  if (!productId || quantity === 0) throw nodeError('action.update_inventory', 'productId and non-zero quantity required')

  const warehouseId =
    String(getByPath(vars, cfg.warehouseIdField ?? '') ?? '').trim() ||
    (await resolveDefaultWarehouseId(engineCtx.tenantId))
  const typeRaw = String(getByPath(vars, cfg.transactionTypeField) ?? 'ADJUSTMENT').toUpperCase()
  const transactionType = (typeRaw as StockTransactionType) || 'ADJUSTMENT'
  const reason = String(getByPath(vars, cfg.reasonField) ?? 'Workflow inventory adjustment')

  const result = await recordTransaction(engineCtx.tenantId, {
    productId,
    warehouseId,
    transactionType,
    quantity,
    referenceType: 'WORKFLOW_ADJUSTMENT',
    referenceId: engineCtx.executionId,
    notes: reason,
    performedBy: actorId,
  })

  ctx.appendLog(`Inventory adjusted for product ${productId}: ${quantity}`)
  return { outputData: { ...inputData, inventoryAdjustment: result, productId, quantity } }
}
