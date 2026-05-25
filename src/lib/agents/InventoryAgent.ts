import { StockTransactionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { classifyStock } from '@/lib/inventory/inventoryDashboardService'
import { createPO, receiveGoods } from '@/lib/inventory/purchaseOrderService'
import { generateReorderSuggestions } from '@/lib/inventory/reorderService'
import { getStockBalance, recordTransaction } from '@/lib/inventory/stockEngine'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function classifyUrgency(onHand: number, reorderPoint: number): 'critical' | 'warning' | 'ok' {
  if (onHand <= 0) return 'critical'
  if (reorderPoint > 0 && onHand <= reorderPoint) return 'warning'
  return 'ok'
}

async function resolveDefaultWarehouseId(tenantId: string): Promise<string> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) throw new Error('No active warehouse configured')
  return warehouse.id
}

export class InventoryAgent extends BaseAgent<AgentTaskInput, Record<string, unknown>> {
  private readonly actorId?: string

  readonly systemPrompt = `You are an expert Supply Chain Manager AI agent with full ERP inventory access.
Monitor stock levels, predict demand, calculate reorder points, create purchase orders, and receive goods.
Proactively flag low stock and suggest reorders with quantities, suppliers, and timing. All data is live from the tenant database.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getStockLevels', description: 'StockBalance joined to Product, optional warehouse filter', parameters: { warehouseId: 'string' } },
    { name: 'getLowStockItems', description: 'Products at or below reorder point with urgency classification' },
    { name: 'getReorderSuggestions', description: 'EOQ-based reorder suggestions grouped by supplier' },
    { name: 'createPurchaseOrder', description: 'Create draft PO', parameters: { supplierId: 'string', items: 'array' } },
    { name: 'receiveGoods', description: 'Receive goods against a PO', parameters: { poId: 'string', items: 'array' } },
    { name: 'adjustStock', description: 'Record stock adjustment via stockEngine', parameters: { productId: 'string', quantity: 'number', type: 'string', reason: 'string' } },
    { name: 'queryKnowledgeBase', description: 'Search inventory knowledge' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'inventory', undefined, userId, taskId)
    this.actorId = userId
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getStockLevels':
        return this.getStockLevels(input.warehouseId ? String(input.warehouseId) : undefined)
      case 'getLowStockItems':
        return this.getLowStockItems()
      case 'getReorderSuggestions':
        return this.getReorderSuggestions()
      case 'createPurchaseOrder':
        return this.createPurchaseOrder(
          String(input.supplierId ?? ''),
          (input.items as Array<{ productId: string; quantity: number; unitCost: number }>) ?? [],
        )
      case 'receiveGoods':
        return this.receiveGoods(
          String(input.poId ?? ''),
          (input.items as Array<{ poItemIndex: number; quantityReceived: number; unitCost?: number }>) ?? [],
        )
      case 'adjustStock':
      case 'createStockAdjustment':
        return this.adjustStock(
          String(input.productId ?? ''),
          Number(input.quantity ?? input.qty ?? 0),
          String(input.type ?? 'ADJUSTMENT'),
          String(input.reason ?? input.notes ?? 'Agent stock adjustment'),
        )
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'inventory'), 'product')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/reorder|suggestion/i.test(lower)) {
      return { reasoning: 'Generating reorder suggestions', plannedTool: 'getReorderSuggestions', plannedInput: {}, iteration }
    }
    if (/low stock|below reorder/i.test(lower)) {
      return { reasoning: 'Checking low stock items', plannedTool: 'getLowStockItems', plannedInput: {}, iteration }
    }
    if (/purchase order|create po/i.test(lower)) {
      return { reasoning: 'Reviewing reorder needs before PO', plannedTool: 'getReorderSuggestions', plannedInput: {}, iteration }
    }
    if (/adjust|write[- ]?off|correction/i.test(lower)) {
      return { reasoning: 'Stock adjustment', plannedTool: 'adjustStock', plannedInput: {}, iteration }
    }
    return { reasoning: 'Inventory stock overview', plannedTool: 'getStockLevels', plannedInput: {}, iteration }
  }

  /** StockBalance × Product, ordered by on-hand ascending (lowest first). */
  async getStockLevels(warehouseId?: string) {
    const balances = await prisma.stockBalance.findMany({
      where: {
        tenantId: this.tenantId,
        product: { isActive: true, trackInventory: true },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            reorderPoint: true,
            reorderQuantity: true,
          },
        },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { quantityOnHand: 'asc' },
    })

    return balances.map((sb) => {
      const onHand = toNumber(sb.quantityOnHand)
      const reserved = toNumber(sb.quantityReserved)
      const onOrder = toNumber(sb.quantityOnOrder)
      const reorderPoint = toNumber(sb.product.reorderPoint)
      return {
        productId: sb.product.id,
        sku: sb.product.sku,
        name: sb.product.name,
        warehouseId: sb.warehouseId,
        warehouseName: sb.warehouse.name,
        quantityOnHand: onHand,
        quantityReserved: reserved,
        quantityAvailable: onHand - reserved,
        quantityOnOrder: onOrder,
        reorderPoint,
        reorderQuantity: toNumber(sb.product.reorderQuantity),
        stockHealth: classifyStock(onHand, reorderPoint),
        urgency: classifyUrgency(onHand, reorderPoint),
      }
    })
  }

  /** Products where on-hand ≤ reorder point, with critical/warning urgency. */
  async getLowStockItems() {
    const levels = await this.getStockLevels()
    const low = levels.filter((row) => row.reorderPoint > 0 && row.quantityOnHand <= row.reorderPoint)

    return {
      count: low.length,
      items: low
        .map((row) => ({
          ...row,
          urgency: row.urgency === 'ok' ? 'warning' : row.urgency,
          daysOfCover:
            row.quantityOnHand > 0 && row.reorderPoint > 0
              ? Math.round((row.quantityOnHand / row.reorderPoint) * 10) / 10
              : 0,
        }))
        .sort((a, b) => a.quantityOnHand - b.quantityOnHand),
    }
  }

  async getReorderSuggestions() {
    return generateReorderSuggestions(this.tenantId, 'all')
  }

  async adjustStock(productId: string, quantity: number, type: string, reason: string) {
    if (!productId || quantity === 0) throw new Error('productId and non-zero quantity are required')

    const warehouseId = await resolveDefaultWarehouseId(this.tenantId)
    const transactionType = (type.toUpperCase() as StockTransactionType) || 'ADJUSTMENT'

    const result = await recordTransaction(this.tenantId, {
      productId,
      warehouseId,
      transactionType,
      quantity,
      referenceType: 'AGENT_ADJUSTMENT',
      referenceId: `agent-${Date.now()}`,
      notes: reason,
      performedBy: this.actorId,
    })

    const balances = await getStockBalance(this.tenantId, productId, warehouseId)
    return { ...result, balances, reason, transactionType }
  }

  async createPurchaseOrder(
    supplierId: string,
    items: Array<{ productId: string; quantity: number; unitCost: number }>,
  ) {
    if (!supplierId || !items.length) throw new Error('supplierId and items are required')

    const warehouseId = await resolveDefaultWarehouseId(this.tenantId)
    const created = await createPO(
      this.tenantId,
      {
        supplierId,
        warehouseId,
        shippingCost: 0,
        currency: 'USD',
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          taxRate: 0,
        })),
      },
      this.actorId,
    )

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: created.id, tenantId: this.tenantId },
      select: { id: true, poNumber: true, status: true, supplierId: true, grandTotal: true },
    })

    return {
      id: created.id,
      poNumber: created.poNumber,
      status: po?.status ?? 'DRAFT',
      supplierId: po?.supplierId ?? supplierId,
      total: toNumber(po?.grandTotal),
      itemCount: items.length,
    }
  }

  async receiveGoods(
    poId: string,
    items: Array<{ poItemIndex: number; quantityReceived: number; unitCost?: number }>,
  ) {
    if (!poId || !items.length) throw new Error('poId and items are required')
    const result = await receiveGoods(poId, { items }, this.actorId)
    return {
      poId,
      receiptId: result.receiptId,
      receiptNumber: result.receiptNumber,
      poStatus: result.poStatus,
      receivedItems: items.length,
    }
  }
}
