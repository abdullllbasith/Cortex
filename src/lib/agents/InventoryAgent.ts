import { StockTransactionType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getLowStockProducts, classifyStock } from '@/lib/inventory/inventoryDashboardService'
import { getProductLedger } from '@/lib/inventory/inventoryCatalogService'
import { createPO } from '@/lib/inventory/purchaseOrderService'
import { getStockBalance, recordTransaction } from '@/lib/inventory/stockEngine'
import { BaseAgent } from './core/BaseAgent'
import type { AgentTaskInput, AgentToolDefinition } from './core/types'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
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

  readonly systemPrompt = `You are an expert Supply Chain Manager AI agent.
Monitor stock levels, predict demand, calculate reorder points, and optimize supplier relationships.
Proactively flag low stock and suggest reorders with quantities and timing.`

  readonly tools: AgentToolDefinition[] = [
    { name: 'getStockLevels', description: 'Get current stock levels for all products' },
    { name: 'getLowStockItems', description: 'Get items below reorder threshold' },
    { name: 'updateStock', description: 'Record a stock adjustment', parameters: { productId: 'string', quantity: 'number', type: 'string', notes: 'string' } },
    { name: 'getStockHistory', description: 'Get stock ledger history for a product', parameters: { productId: 'string', period: 'string' } },
    { name: 'createPurchaseOrder', description: 'Create a draft purchase order', parameters: { supplierId: 'string', items: 'array' } },
    { name: 'getSupplierLeadTimes', description: 'Get supplier lead time data' },
    { name: 'calculateReorderPoint', description: 'Calculate reorder point for a product', parameters: { productId: 'string' } },
    { name: 'queryKnowledgeBase', description: 'Search inventory knowledge' },
  ]

  constructor(tenantId: string, userId?: string, taskId?: string) {
    super(tenantId, 'inventory', undefined, userId, taskId)
    this.actorId = userId
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'getStockLevels':
        return this.getStockLevels()
      case 'getLowStockItems':
        return this.getLowStockItems()
      case 'updateStock':
        return this.updateStock(
          String(input.productId ?? ''),
          Number(input.quantity ?? 0),
          String(input.type ?? 'ADJUSTMENT'),
          input.notes ? String(input.notes) : undefined,
        )
      case 'getStockHistory':
        return this.getStockHistory(String(input.productId ?? ''), String(input.period ?? '30d'))
      case 'createPurchaseOrder':
        return this.createPurchaseOrder(
          String(input.supplierId ?? ''),
          (input.items as Array<{ productId: string; quantity: number; unitCost: number }>) ?? [],
        )
      case 'getSupplierLeadTimes':
        return this.getSupplierLeadTimes()
      case 'calculateReorderPoint':
        return this.calculateReorderPoint(String(input.productId ?? ''))
      case 'queryKnowledgeBase':
        return this.toolkit.queryKnowledgeBase(String(input.query ?? 'inventory'), 'product')
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }

  protected heuristicThink(input: AgentTaskInput, iteration: number) {
    const lower = input.task.toLowerCase()
    if (/low stock|stock level|out of stock/i.test(lower)) {
      return { reasoning: 'Checking low stock items', plannedTool: 'getLowStockItems', plannedInput: {}, iteration }
    }
    if (/reorder|purchase order/i.test(lower)) {
      return { reasoning: 'Checking reorder recommendations', plannedTool: 'getLowStockItems', plannedInput: {}, iteration }
    }
    return { reasoning: 'Inventory overview', plannedTool: 'getStockLevels', plannedInput: {}, iteration }
  }

  async getStockLevels() {
    const products = await prisma.product.findMany({
      where: { tenantId: this.tenantId, isActive: true, trackInventory: true },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderPoint: true,
        stockBalances: { select: { quantityOnHand: true, quantityReserved: true } },
      },
      orderBy: { name: 'asc' },
    })

    return products.map((p) => {
      const onHand = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
      const reserved = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityReserved), 0)
      const reorderPoint = toNumber(p.reorderPoint)
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        quantityOnHand: onHand,
        quantityAvailable: onHand - reserved,
        reorderPoint,
        stockHealth: classifyStock(onHand, reorderPoint),
      }
    })
  }

  async getLowStockItems() {
    const items = await getLowStockProducts(this.tenantId)
    return {
      count: items.length,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        onHand: item.onHand,
        reorderPoint: item.reorderPoint,
        suggestedOrderQty: item.suggestedOrderQty,
        urgency:
          item.onHand <= 0 ? 'immediate' : item.onHand <= item.reorderPoint * 0.5 ? 'high' : 'within_week',
      })),
    }
  }

  async updateStock(
    productId: string,
    quantity: number,
    type: string,
    notes?: string,
  ) {
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
      notes: notes ?? 'Inventory agent stock update',
      performedBy: this.actorId,
    })

    const balances = await getStockBalance(this.tenantId, productId)
    return { ...result, balances }
  }

  async getStockHistory(productId: string, period: string) {
    const ledger = await getProductLedger(this.tenantId, productId, { page: 1, limit: 50 })
    let entries = ledger.entries

    if (period && period !== 'all') {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      entries = entries.filter((e) => new Date(e.createdAt) >= cutoff)
    }

    return { productId, period, count: entries.length, entries }
  }

  async createPurchaseOrder(
    supplierId: string,
    items: Array<{ productId: string; quantity: number; unitCost: number }>,
  ) {
    if (!supplierId || !items.length) throw new Error('supplierId and items are required')

    const warehouseId = await resolveDefaultWarehouseId(this.tenantId)
    return createPO(
      this.tenantId,
      {
        supplierId,
        warehouseId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          taxRate: 0,
        })),
      },
      this.actorId,
    )
  }

  async getSupplierLeadTimes() {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: this.tenantId },
      select: { id: true, name: true, performanceScore: true, reliabilityMetrics: true },
    })

    return suppliers.map((s) => ({
      supplierId: s.id,
      name: s.name,
      avgLeadTimeDays: Math.round(14 - s.performanceScore / 10),
      reliability: s.performanceScore,
      metrics: s.reliabilityMetrics,
    }))
  }

  async calculateReorderPoint(productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: this.tenantId },
      include: { stockBalances: { select: { quantityOnHand: true } } },
    })
    if (!product) throw new Error('Product not found')

    const onHand = product.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
    const reorderPoint = toNumber(product.reorderPoint)

    return {
      productId: product.id,
      name: product.name,
      currentStock: onHand,
      reorderPoint,
      shouldReorder: reorderPoint > 0 && onHand <= reorderPoint,
      suggestedOrderQty: toNumber(product.reorderQuantity) || reorderPoint * 2,
    }
  }
}
