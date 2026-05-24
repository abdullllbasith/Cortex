import { prisma } from '@/lib/db/prisma'
import { getLowStockProducts } from '@/lib/inventory/inventoryDashboardService'
import { classifyStock } from '@/lib/inventory/inventoryDashboardService'
import { createPO } from '@/lib/inventory/purchaseOrderService'
import { getStockBalance, recordTransaction } from '@/lib/inventory/stockEngine'
import type { ActionTaken, IntentClassification } from '../types'

function actionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function resolveDefaultWarehouseId(tenantId: string): Promise<string | null> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  return warehouse?.id ?? null
}

async function findProductByName(tenantId: string, name: string) {
  if (!name) return null
  return prisma.product.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { name: { contains: name, mode: 'insensitive' } },
        { sku: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, sku: true, reorderPoint: true, costPrice: true, supplierId: true },
  })
}

export async function handleInventoryAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const actions: ActionTaken[] = []
  const quantity = Number(classification.entities.quantity ?? 0)
  const productName = String(classification.entities.productName ?? '').trim()
  const supplierName = String(classification.entities.supplierName ?? '').trim()
  const lower = message.toLowerCase()

  const isStockUpdate =
    classification.intent === 'COMMAND' &&
    quantity > 0 &&
    /\b(add|increase|restock|stock)\b/i.test(message)

  if (isStockUpdate) {
    const product = await findProductByName(tenantId, productName)
    const warehouseId = await resolveDefaultWarehouseId(tenantId)

    if (product && warehouseId) {
      const before = await getStockBalance(tenantId, product.id)
      const previousLevel = before.reduce((s, b) => s + b.quantityOnHand, 0)

      const result = await recordTransaction(tenantId, {
        productId: product.id,
        warehouseId,
        transactionType: 'ADJUSTMENT',
        quantity,
        referenceType: 'ASSISTANT_ADJUSTMENT',
        referenceId: `asst-${Date.now()}`,
        notes: `Assistant: add ${quantity} units`,
        performedBy: userId,
      })

      actions.push({
        id: actionId(),
        type: 'inventory.update_stock',
        description: `Added ${quantity} units to "${product.name}" (${previousLevel} → ${result.totalOnHand})`,
        entityType: 'product',
        entityId: product.id,
        reversible: true,
        undoPayload: {
          productId: product.id,
          warehouseId,
          quantity: -quantity,
          ledgerId: result.ledgerId,
        },
        status: 'completed',
      })
      return actions
    }

    actions.push({
      id: actionId(),
      type: 'inventory.update_stock',
      description: productName
        ? `Could not find product "${productName}" to update stock`
        : 'Specify a product name to update inventory',
      status: 'failed',
    })
    return actions
  }

  const isStockCheck =
    /\b(check\s+stock|stock\s+(of|for|level)|how\s+much\s+.*\s+(left|in\s+stock))\b/i.test(message) ||
    (productName && /\bstock\b/i.test(message))

  if (isStockCheck) {
    const product = await findProductByName(tenantId, productName)
    if (!product) {
      actions.push({
        id: actionId(),
        type: 'inventory.check_stock',
        description: productName ? `Product "${productName}" not found` : 'Specify a product to check stock',
        status: 'failed',
      })
      return actions
    }

    const balances = await getStockBalance(tenantId, product.id)
    const onHand = balances.reduce((s, b) => s + b.quantityOnHand, 0)
    const reorderPoint = Number(product.reorderPoint)
    const isLow = classifyStock(onHand, reorderPoint) !== 'in_stock'

    actions.push({
      id: actionId(),
      type: 'inventory.check_stock',
      description: `"${product.name}" (${product.sku}): ${onHand} on hand${isLow ? ' — below reorder point' : ''}`,
      entityType: 'product',
      entityId: product.id,
      status: 'completed',
      undoPayload: { productId: product.id, onHand, isLow, balances },
    })
    return actions
  }

  const isLowStockQuery = /\b(low\s+on\s+stock|what(?:'s|\s+is)\s+low|reorder|below\s+reorder)\b/i.test(lower)

  if (isLowStockQuery) {
    const items = await getLowStockProducts(tenantId)
    actions.push({
      id: actionId(),
      type: 'inventory.low_stock_report',
      description:
        items.length > 0
          ? `${items.length} item(s) below reorder point — top: ${items.slice(0, 3).map((i) => i.name).join(', ')}`
          : 'All tracked products are above reorder points',
      status: 'completed',
      undoPayload: { items },
    })
    return actions
  }

  const isCreatePO =
    /\b(create|draft|new)\b.*\bpurchase\s+order\b/i.test(message) ||
    /\bpurchase\s+order\s+for\b/i.test(message)

  if (isCreatePO && supplierName) {
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId, name: { contains: supplierName, mode: 'insensitive' } },
    })

    if (!supplier) {
      actions.push({
        id: actionId(),
        type: 'inventory.create_po',
        description: `Supplier "${supplierName}" not found`,
        status: 'failed',
      })
      return actions
    }

    const warehouseId = await resolveDefaultWarehouseId(tenantId)
    if (!warehouseId) {
      actions.push({
        id: actionId(),
        type: 'inventory.create_po',
        description: 'No warehouse configured — cannot create purchase order',
        status: 'failed',
      })
      return actions
    }

    const lowStock = await getLowStockProducts(tenantId)
    const supplierItems = await prisma.product.findMany({
      where: {
        tenantId,
        supplierId: supplier.id,
        isActive: true,
        id: { in: lowStock.map((i) => i.productId) },
      },
      select: { id: true, costPrice: true, reorderQuantity: true },
    })

    const itemMap = new Map(lowStock.map((i) => [i.productId, i]))
    const poItems =
      supplierItems.length > 0
        ? supplierItems.map((p) => ({
            productId: p.id,
            quantity: itemMap.get(p.id)?.suggestedOrderQty ?? (Number(p.reorderQuantity) || 10),
            unitCost: Number(p.costPrice),
            taxRate: 0,
          }))
        : []

    if (!poItems.length) {
      actions.push({
        id: actionId(),
        type: 'inventory.create_po',
        description: `No low-stock items found for supplier "${supplier.name}"`,
        status: 'failed',
      })
      return actions
    }

    const po = await createPO(
      tenantId,
      { supplierId: supplier.id, warehouseId, items: poItems },
      userId,
    )

    actions.push({
      id: actionId(),
      type: 'inventory.create_po',
      description: `Created draft PO ${po.poNumber} for ${supplier.name} (${poItems.length} line items)`,
      entityType: 'purchase_order',
      entityId: po.id,
      status: 'completed',
      undoPayload: { poId: po.id, poNumber: po.poNumber },
    })
    return actions
  }

  if (/\b(low stock|inventory level|stock level)\b/i.test(message)) {
    const levels = await getLowStockProducts(tenantId)
    actions.push({
      id: actionId(),
      type: 'inventory.list_levels',
      description: `Retrieved ${levels.length} low-stock recommendation(s)`,
      status: 'completed',
      undoPayload: { items: levels },
    })
  }

  return actions
}

export async function undoInventoryAction(
  tenantId: string,
  userId: string,
  action: ActionTaken,
): Promise<boolean> {
  if (action.type !== 'inventory.update_stock' || !action.undoPayload) return false

  const { productId, warehouseId, quantity } = action.undoPayload as {
    productId: string
    warehouseId: string
    quantity: number
  }

  if (!warehouseId || !quantity) return false

  await recordTransaction(tenantId, {
    productId,
    warehouseId,
    transactionType: 'ADJUSTMENT',
    quantity,
    referenceType: 'ASSISTANT_UNDO',
    referenceId: `undo-${Date.now()}`,
    notes: 'Undo assistant stock adjustment',
    performedBy: userId,
  })

  return true
}
