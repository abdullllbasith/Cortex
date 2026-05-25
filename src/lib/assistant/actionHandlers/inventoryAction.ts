import { prisma } from '@/lib/db/prisma'
import { InventoryAgent } from '@/lib/agents/InventoryAgent'
import { classifyStock } from '@/lib/inventory/inventoryDashboardService'
import { getStockBalance } from '@/lib/inventory/stockEngine'
import { fetchReorderStatus } from './actionExecutor'
import type { ActionTaken, IntentClassification } from '../types'
import { actionId, completedAction, confirmationAction, failedAction } from './actionUtils'

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
    select: {
      id: true,
      name: true,
      sku: true,
      reorderPoint: true,
      costPrice: true,
      supplierId: true,
    },
  })
}

export async function handleInventoryAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  void userId
  const actions: ActionTaken[] = []
  const quantity = Number(classification.entities.quantity ?? 0)
  const productName = String(classification.entities.productName ?? '').trim()
  const supplierName = String(classification.entities.supplierName ?? '').trim()
  const lower = message.toLowerCase()

  const isStockUpdate =
    classification.intent === 'COMMAND' &&
    quantity !== 0 &&
    /\b(add|remove|increase|decrease|adjust|restock|stock)\b/i.test(message)

  if (isStockUpdate) {
    const product = await findProductByName(tenantId, productName)
    const warehouseId = await resolveDefaultWarehouseId(tenantId)
    if (!product || !warehouseId) {
      return [
        failedAction(
          productName ? `Product "${productName}" not found` : 'Specify a product to adjust stock',
          'inventory.update_stock',
        ),
      ]
    }

    const signedQty = /\b(remove|decrease|deduct)\b/i.test(message) ? -Math.abs(quantity) : quantity
    const balances = await getStockBalance(tenantId, product.id)
    const onHand = balances.reduce((s, b) => s + b.quantityOnHand, 0)

    return [
      confirmationAction({
        type: 'inventory.update_stock',
        description: `${signedQty > 0 ? 'Add' : 'Remove'} ${Math.abs(signedQty)} units of "${product.name}"`,
        displayTitle: `${signedQty > 0 ? 'Add' : 'Remove'} stock`,
        parameters: [
          { label: 'Product', value: `${product.name} (${product.sku})` },
          { label: 'Quantity', value: String(signedQty) },
          { label: 'Current on hand', value: String(onHand) },
        ],
        executePayload: {
          productId: product.id,
          warehouseId,
          quantity: signedQty,
          reason: `Assistant: ${signedQty > 0 ? 'add' : 'remove'} ${Math.abs(signedQty)} units`,
        },
        entityType: 'product',
        entityId: product.id,
        reversible: true,
      }),
    ]
  }

  const isStockCheck =
    /\b(check\s+stock|stock\s+(of|for|level)|how\s+much\s+.*\s+(left|in\s+stock))\b/i.test(message) ||
    (productName && /\bstock\b/i.test(message))

  if (isStockCheck) {
    const product = await findProductByName(tenantId, productName)
    if (!product) {
      return [
        failedAction(
          productName ? `Product "${productName}" not found` : 'Specify a product to check stock',
          'inventory.check_stock',
        ),
      ]
    }

    const balances = await getStockBalance(tenantId, product.id)
    const onHand = balances.reduce((s, b) => s + b.quantityOnHand, 0)
    const reorderPoint = Number(product.reorderPoint)
    const health = classifyStock(onHand, reorderPoint)

    return [
      completedAction({
        type: 'inventory.check_stock',
        description: `"${product.name}" (${product.sku}): ${onHand} on hand — ${health.replace(/_/g, ' ')}${reorderPoint ? ` (reorder at ${reorderPoint})` : ''}`,
        entityType: 'product',
        entityId: product.id,
        recordLink: `/inventory/products/${product.id}`,
      }),
    ]
  }

  if (/\b(low\s+on\s+stock|what(?:'s|\s+is)\s+low|below\s+reorder)\b/i.test(lower)) {
    const agent = new InventoryAgent(tenantId)
    const low = await agent.getLowStockItems()
    const lines = low.items
      .slice(0, 10)
      .map(
        (i) =>
          `• ${i.name} (${i.sku}): ${i.quantityOnHand} on hand [${i.urgency}]`,
      )
      .join('\n')

    return [
      completedAction({
        type: 'inventory.low_stock_report',
        description:
          low.count > 0
            ? `${low.count} item(s) below reorder:\n${lines}`
            : 'All tracked products are above reorder points',
        undoPayload: { items: low.items },
      }),
    ]
  }

  if (/\breorder\s+status|reorder\s+suggestion/i.test(lower)) {
    const reorder = await fetchReorderStatus(tenantId)
    return [
      completedAction({
        type: 'inventory.reorder_status',
        description: `${reorder.totalSuggestions} reorder suggestion(s) across ${reorder.groups.length} supplier group(s)`,
        undoPayload: { reorder },
      }),
    ]
  }

  const isCreatePO =
    /\b(create|draft|new)\b.*\bpurchase\s+order\b/i.test(message) ||
    /\bpurchase\s+order\s+for\b/i.test(message) ||
    /\bcreate\s+po\s+for\b/i.test(lower)

  if (isCreatePO && supplierName) {
    const supplier = await prisma.supplier.findFirst({
      where: { tenantId, name: { contains: supplierName, mode: 'insensitive' } },
    })
    if (!supplier) {
      return [failedAction(`Supplier "${supplierName}" not found`, 'inventory.create_po')]
    }

    const warehouseId = await resolveDefaultWarehouseId(tenantId)
    if (!warehouseId) {
      return [failedAction('No active warehouse configured', 'inventory.create_po')]
    }

    const agent = new InventoryAgent(tenantId)
    const lowStock = await agent.getLowStockItems()
    const supplierProducts = await prisma.product.findMany({
      where: {
        tenantId,
        supplierId: supplier.id,
        isActive: true,
        id: { in: lowStock.items.map((i) => i.productId) },
      },
      select: { id: true, costPrice: true, reorderQuantity: true, name: true },
    })

    const poItems = supplierProducts.map((p) => {
      const low = lowStock.items.find((i) => i.productId === p.id)
      return {
        productId: p.id,
        quantity: (low?.reorderQuantity ?? Number(p.reorderQuantity)) || 10,
        unitCost: Number(p.costPrice),
        taxRate: 0,
      }
    })

    if (!poItems.length) {
      return [
        failedAction(
          `No low-stock products linked to supplier "${supplier.name}"`,
          'inventory.create_po',
        ),
      ]
    }

    return [
      confirmationAction({
        type: 'inventory.create_po',
        description: `Create draft PO for ${supplier.name} (${poItems.length} lines)`,
        displayTitle: 'Create purchase order',
        parameters: [
          { label: 'Supplier', value: supplier.name },
          { label: 'Line items', value: String(poItems.length) },
          { label: 'Est. total', value: `$${poItems.reduce((s, i) => s + i.quantity * i.unitCost, 0).toLocaleString()}` },
        ],
        executePayload: { supplierId: supplier.id, warehouseId, items: poItems },
        entityType: 'supplier',
        entityId: supplier.id,
      }),
    ]
  }

  if (/\b(stock level|inventory level)\b/i.test(lower)) {
    const agent = new InventoryAgent(tenantId)
    const levels = await agent.getStockLevels()
    const critical = levels.filter((l) => l.urgency === 'critical').length
    return [
      completedAction({
        type: 'inventory.list_levels',
        description: `${levels.length} SKU(s) tracked; ${critical} critical`,
      }),
    ]
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

  const { recordTransaction } = await import('@/lib/inventory/stockEngine')
  await recordTransaction(tenantId, {
    productId,
    warehouseId,
    transactionType: 'ADJUSTMENT',
    quantity,
    referenceType: 'ASSISTANT_UNDO',
    referenceId: `undo-${actionId()}`,
    notes: 'Undo assistant stock adjustment',
    performedBy: userId,
  })

  return true
}
