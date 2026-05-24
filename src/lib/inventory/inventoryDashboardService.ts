import { prisma } from '@/lib/db/prisma'
import { calculateInventoryValue } from './valuationService'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export type StockHealth = 'in_stock' | 'low_stock' | 'out_of_stock'

export function classifyStock(onHand: number, reorderPoint: number): StockHealth {
  if (onHand <= 0) return 'out_of_stock'
  if (reorderPoint > 0 && onHand <= reorderPoint) return 'low_stock'
  return 'in_stock'
}

export async function getInventoryDashboard(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true, trackInventory: true },
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQuantity: true,
      costPrice: true,
      sellingPrice: true,
    },
  })

  const balances = await prisma.stockBalance.groupBy({
    by: ['productId'],
    where: { tenantId },
    _sum: {
      quantityOnHand: true,
      quantityOnOrder: true,
    },
  })

  const balanceMap = new Map(
    balances.map((b) => [
      b.productId,
      {
        onHand: toNumber(b._sum.quantityOnHand),
        onOrder: toNumber(b._sum.quantityOnOrder),
      },
    ]),
  )

  let inStock = 0
  let lowStock = 0
  let outOfStock = 0
  let itemsOnOrder = 0
  const reorderRecommendations: Array<{
    productId: string
    sku: string
    name: string
    onHand: number
    reorderPoint: number
    reorderQuantity: number
    suggestedOrderQty: number
  }> = []

  for (const product of products) {
    const bal = balanceMap.get(product.id) ?? { onHand: 0, onOrder: 0 }
    const reorderPoint = toNumber(product.reorderPoint)
    const health = classifyStock(bal.onHand, reorderPoint)

    if (health === 'in_stock') inStock++
    else if (health === 'low_stock') lowStock++
    else outOfStock++

    itemsOnOrder += bal.onOrder

    if (reorderPoint > 0 && bal.onHand <= reorderPoint) {
      const reorderQty = toNumber(product.reorderQuantity) || reorderPoint
      reorderRecommendations.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        onHand: bal.onHand,
        reorderPoint,
        reorderQuantity: reorderQty,
        suggestedOrderQty: Math.max(reorderQty, reorderPoint - bal.onHand + reorderQty),
      })
    }
  }

  const valuation = await calculateInventoryValue(tenantId)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const fastMovingRaw = await prisma.stockLedger.groupBy({
    by: ['productId'],
    where: {
      tenantId,
      transactionType: 'SALE',
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { quantity: true },
  })

  const fastMovingSorted = fastMovingRaw
    .map((row) => ({
      productId: row.productId,
      unitsSold: Math.abs(toNumber(row._sum.quantity)),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10)

  const fastProductIds = fastMovingSorted.map((r) => r.productId)
  const fastProducts = await prisma.product.findMany({
    where: { id: { in: fastProductIds } },
    select: { id: true, sku: true, name: true, sellingPrice: true },
  })
  const fastMap = new Map(fastProducts.map((p) => [p.id, p]))

  const fastMoving = fastMovingSorted.map((row) => {
    const p = fastMap.get(row.productId)
    return {
      productId: row.productId,
      sku: p?.sku ?? '—',
      name: p?.name ?? 'Unknown',
      unitsSold: row.unitsSold,
      revenue: row.unitsSold * toNumber(p?.sellingPrice),
      velocity: row.unitsSold / 30,
    }
  })

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const recentMovement = await prisma.stockLedger.findMany({
    where: { tenantId, createdAt: { gte: ninetyDaysAgo } },
    select: { productId: true },
    distinct: ['productId'],
  })
  const movedIds = new Set(recentMovement.map((r) => r.productId))

  const deadStockCandidates = products.filter((p) => {
    const onHand = balanceMap.get(p.id)?.onHand ?? 0
    return onHand > 0 && !movedIds.has(p.id)
  })

  const deadStock = deadStockCandidates
    .map((p) => {
      const onHand = balanceMap.get(p.id)?.onHand ?? 0
      const unitCost = toNumber(p.costPrice)
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        quantityOnHand: onHand,
        valueTiedUp: onHand * unitCost,
        daysIdle: 90,
      }
    })
    .sort((a, b) => b.valueTiedUp - a.valueTiedUp)
    .slice(0, 20)

  return {
    kpis: {
      totalSkus: products.length,
      totalInventoryValue: valuation.totalValue,
      lowStockItems: lowStock,
      outOfStock,
      itemsOnOrder: Math.round(itemsOnOrder),
    },
    stockHealth: [
      { name: 'In Stock', value: inStock, key: 'in_stock' as const },
      { name: 'Low Stock', value: lowStock, key: 'low_stock' as const },
      { name: 'Out of Stock', value: outOfStock, key: 'out_of_stock' as const },
    ],
    fastMoving,
    deadStock,
    reorderRecommendations: reorderRecommendations.sort(
      (a, b) => a.onHand - b.onHand,
    ),
  }
}

export async function getLowStockProducts(tenantId: string) {
  const dashboard = await getInventoryDashboard(tenantId)
  return dashboard.reorderRecommendations
}
