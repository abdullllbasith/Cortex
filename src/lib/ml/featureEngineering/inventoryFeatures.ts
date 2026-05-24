import { InventoryEventType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { addDays, dateKey, startOfDay } from '../utils'

const LOOKBACK_DAYS = 60

export interface InventoryFeatureVector {
  productId: string
  productName: string
  currentStock: number
  dailyConsumptionRate: number
  weeklyDemand: number
  demandVariance: number
  seasonalityIndex: number
  leadTimeVariability: number
}

export async function extractInventoryFeatures(tenantId: string): Promise<InventoryFeatureVector[]> {
  const end = startOfDay(new Date())
  const start = addDays(end, -LOOKBACK_DAYS)

  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, name: true, inventoryLevel: true, supplierInfo: true },
  })

  const events = await prisma.inventoryEvent.findMany({
    where: {
      tenantId,
      timestamp: { gte: start, lte: end },
      type: { in: [InventoryEventType.SALE, InventoryEventType.WASTE] },
    },
    select: { productId: true, quantity: true, timestamp: true },
  })

  const dailyByProduct = new Map<string, Map<string, number>>()
  for (const e of events) {
    const key = dateKey(e.timestamp)
    const pmap = dailyByProduct.get(e.productId) ?? new Map()
    pmap.set(key, (pmap.get(key) ?? 0) + Math.abs(e.quantity))
    dailyByProduct.set(e.productId, pmap)
  }

  return products.map((p) => {
    const daily = dailyByProduct.get(p.id) ?? new Map<string, number>()
    const dailyValues = Array.from(daily.values())
    const totalConsumption = dailyValues.reduce((a, b) => a + b, 0)
    const activeDays = dailyValues.length || 1
    const dailyConsumptionRate = totalConsumption / LOOKBACK_DAYS
    const weeklyDemand = dailyConsumptionRate * 7

    const mean = dailyValues.length
      ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
      : dailyConsumptionRate
    const variance = dailyValues.length
      ? dailyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyValues.length
      : 0
    const demandVariance = Math.sqrt(variance)

    const dowTotals = new Array(7).fill(0)
    const dowCounts = new Array(7).fill(0)
    for (const [dayStr, qty] of daily) {
      const dow = new Date(dayStr).getUTCDay()
      dowTotals[dow] += qty
      dowCounts[dow] += 1
    }
    const overallAvg = mean || 1
    const todayDow = end.getUTCDay()
    const seasonalityIndex = dowCounts[todayDow] > 0
      ? (dowTotals[todayDow] / dowCounts[todayDow]) / overallAvg
      : 1

    const supplier = p.supplierInfo as { avgLeadTimeDays?: number; leadTimeStd?: number }
    const leadTimeVariability = supplier.leadTimeStd ?? (supplier.avgLeadTimeDays ?? 7) * 0.15

    return {
      productId: p.id,
      productName: p.name,
      currentStock: p.inventoryLevel,
      dailyConsumptionRate,
      weeklyDemand,
      demandVariance,
      seasonalityIndex,
      leadTimeVariability,
    }
  })
}

export function inventoryFeaturesToRow(v: InventoryFeatureVector): Record<string, number | string | boolean | null> {
  return {
    productName: v.productName,
    currentStock: v.currentStock,
    dailyConsumptionRate: v.dailyConsumptionRate,
    weeklyDemand: v.weeklyDemand,
    demandVariance: v.demandVariance,
    seasonalityIndex: v.seasonalityIndex,
    leadTimeVariability: v.leadTimeVariability,
  }
}
