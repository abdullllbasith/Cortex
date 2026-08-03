import {
  InventoryCostingMethod,
  Prisma,
  type StockTransactionType,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import type { TenantSettings } from '@/lib/settings/types'
import { toNumber } from './stockEngine'
import type { GrossMarginResult, ValuationLine, ValuationReport } from './types'

const INBOUND_TYPES: StockTransactionType[] = [
  'PURCHASE',
  'TRANSFER_IN',
  'RETURN_IN',
  'OPENING',
  'ADJUSTMENT',
]

interface CostLayer {
  quantity: number
  unitCost: number
  createdAt: Date
}

async function getTenantCostingMethod(tenantId: string): Promise<InventoryCostingMethod> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  })
  const settings = (tenant?.settings ?? {}) as TenantSettings & {
    inventoryCostingMethod?: InventoryCostingMethod
  }
  return settings.inventoryCostingMethod ?? InventoryCostingMethod.WEIGHTED_AVERAGE
}

async function loadInboundLayers(
  tenantId: string,
  productId: string,
  asOfDate: Date,
  warehouseId?: string,
  variantId?: string | null,
): Promise<CostLayer[]> {
  const entries = await prisma.stockLedger.findMany({
    where: {
      tenantId,
      productId,
      ...(warehouseId ? { warehouseId } : {}),
      ...(variantId !== undefined ? { variantId } : {}),
      createdAt: { lte: asOfDate },
      transactionType: { in: INBOUND_TYPES },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      quantity: true,
      unitCost: true,
      transactionType: true,
      createdAt: true,
    },
  })

  const layers: CostLayer[] = []
  for (const entry of entries) {
    let qty = toNumber(entry.quantity)
    if (entry.transactionType === 'ADJUSTMENT' && qty < 0) continue
    qty = Math.abs(qty)
    if (qty <= 0) continue
    layers.push({
      quantity: qty,
      unitCost: toNumber(entry.unitCost),
      createdAt: entry.createdAt,
    })
  }
  return layers
}

function consumeLayers(
  layers: CostLayer[],
  quantityNeeded: number,
  method: InventoryCostingMethod,
): { totalCost: number; remainingLayers: CostLayer[] } {
  const working = layers.map((l) => ({ ...l }))
  let remaining = quantityNeeded
  let totalCost = 0

  const order =
    method === InventoryCostingMethod.LIFO
      ? [...working].reverse()
      : method === InventoryCostingMethod.FIFO
        ? working
        : working

  if (method === InventoryCostingMethod.WEIGHTED_AVERAGE) {
    const totalQty = working.reduce((s, l) => s + l.quantity, 0)
    const totalValue = working.reduce((s, l) => s + l.quantity * l.unitCost, 0)
    const avg = totalQty > 0 ? totalValue / totalQty : 0
    return { totalCost: quantityNeeded * avg, remainingLayers: working }
  }

  for (const layer of order) {
    if (remaining <= 0) break
    const take = Math.min(layer.quantity, remaining)
    totalCost += take * layer.unitCost
    layer.quantity -= take
    remaining -= take
  }

  return {
    totalCost,
    remainingLayers: working.filter((l) => l.quantity > 0),
  }
}

function valueQuantityWithMethod(
  layers: CostLayer[],
  quantityOnHand: number,
  method: InventoryCostingMethod,
): number {
  if (quantityOnHand <= 0) return 0
  const { totalCost } = consumeLayers(layers, quantityOnHand, method)
  return totalCost
}

export async function calculateInventoryValue(
  tenantId: string,
  warehouseId?: string,
  asOfDate: Date = new Date(),
): Promise<{ totalValue: number; costingMethod: InventoryCostingMethod; lines: ValuationLine[] }> {
  const costingMethod = await getTenantCostingMethod(tenantId)

  const balances = await prisma.stockBalance.findMany({
    where: {
      tenantId,
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: {
      product: { select: { id: true, sku: true, name: true, costPrice: true } },
    },
  })

  const lines: ValuationLine[] = []
  let totalValue = 0

  for (const balance of balances) {
    const qty = toNumber(balance.quantityOnHand)
    if (qty <= 0) continue

    let unitCost = toNumber(balance.product.costPrice)
    let lineValue = qty * unitCost

    if (costingMethod !== InventoryCostingMethod.WEIGHTED_AVERAGE || unitCost === 0) {
      const layers = await loadInboundLayers(
        tenantId,
        balance.productId,
        asOfDate,
        balance.warehouseId,
        balance.variantId,
      )

      if (layers.length) {
        lineValue = valueQuantityWithMethod(layers, qty, costingMethod)
        unitCost = qty > 0 ? lineValue / qty : 0
      }
    } else {
      const layers = await loadInboundLayers(
        tenantId,
        balance.productId,
        asOfDate,
        balance.warehouseId,
        balance.variantId,
      )
      if (layers.length) {
        lineValue = valueQuantityWithMethod(layers, qty, costingMethod)
        unitCost = qty > 0 ? lineValue / qty : 0
      }
    }

    lines.push({
      productId: balance.productId,
      variantId: balance.variantId,
      warehouseId: balance.warehouseId,
      sku: balance.product.sku,
      name: balance.product.name,
      quantityOnHand: qty,
      unitCost,
      totalValue: lineValue,
    })
    totalValue += lineValue
  }

  return { totalValue, costingMethod, lines }
}

export async function computeGrossMargin(
  tenantId: string,
  productId: string,
  period: { start: Date; end: Date },
): Promise<GrossMarginResult> {
  const costingMethod = await getTenantCostingMethod(tenantId)

  const sales = await prisma.stockLedger.findMany({
    where: {
      tenantId,
      productId,
      transactionType: 'SALE',
      createdAt: { gte: period.start, lte: period.end },
    },
    select: { quantity: true, unitCost: true, totalCost: true },
  })

  const unitsSold = sales.reduce((sum, row) => sum + Math.abs(toNumber(row.quantity)), 0)

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { sellingPrice: true },
  })
  const sellingPrice = toNumber(product?.sellingPrice)
  const revenue = unitsSold * sellingPrice

  let cogs = sales.reduce((sum, row) => sum + toNumber(row.totalCost), 0)

  if (cogs === 0 && unitsSold > 0) {
    const layers = await loadInboundLayers(tenantId, productId, period.end)
    const { totalCost } = consumeLayers(layers, unitsSold, costingMethod)
    cogs = totalCost
  }

  const grossMargin = revenue - cogs
  const grossMarginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0

  return {
    productId,
    periodStart: period.start,
    periodEnd: period.end,
    unitsSold,
    revenue,
    cogs,
    grossMargin,
    grossMarginPercent,
  }
}

export async function generateValuationReport(
  tenantId: string,
  asOfDate: Date = new Date(),
  warehouseId?: string,
): Promise<ValuationReport> {
  const { totalValue, costingMethod, lines } = await calculateInventoryValue(
    tenantId,
    warehouseId,
    asOfDate,
  )

  return {
    tenantId,
    asOfDate,
    costingMethod,
    totalValue,
    lineCount: lines.length,
    lines: lines.sort((a, b) => b.totalValue - a.totalValue),
  }
}

export async function setTenantCostingMethod(
  tenantId: string,
  method: InventoryCostingMethod,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  })
  const settings = (tenant?.settings ?? {}) as Prisma.JsonObject
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...settings,
        inventoryCostingMethod: method,
      },
    },
  })
}
