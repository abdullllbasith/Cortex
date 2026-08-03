import { SupplierEventType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { addDays, startOfDay } from '../utils'

const WINDOW_DAYS = 180

export interface SupplierFeatureVector {
  supplierId: string
  supplierName: string
  onTimeDeliveryRate: number
  avgDelayDays: number
  costVarianceCoefficient: number
  orderCount: number
  delayCount: number
}

function delayDays(metadata: unknown): number {
  const m = metadata as { delayDays?: number; daysLate?: number }
  return m.delayDays ?? m.daysLate ?? 0
}

function orderCost(metadata: unknown): number {
  const m = metadata as { cost?: number; amount?: number }
  return m.cost ?? m.amount ?? 0
}

export async function extractSupplierFeatures(tenantId: string): Promise<SupplierFeatureVector[]> {
  const windowStart = addDays(startOfDay(new Date()), -WINDOW_DAYS)

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId },
    select: { id: true, name: true, performanceScore: true, costTrends: true },
  })

  const events = await prisma.supplierEvent.findMany({
    where: { tenantId, timestamp: { gte: windowStart } },
    select: { supplierId: true, type: true, metadata: true, timestamp: true },
  })

  const bySupplier = new Map<string, typeof events>()
  for (const e of events) {
    const list = bySupplier.get(e.supplierId) ?? []
    list.push(e)
    bySupplier.set(e.supplierId, list)
  }

  return suppliers.map((s) => {
    const evts = bySupplier.get(s.id) ?? []
    const deliveries = evts.filter((e) => e.type === SupplierEventType.DELIVERY)
    const delays = evts.filter((e) => e.type === SupplierEventType.DELAY)
    const orders = evts.filter((e) => e.type === SupplierEventType.ORDER)

    const onTime = deliveries.filter((e) => delayDays(e.metadata) <= 0).length
    const onTimeDeliveryRate = deliveries.length ? onTime / deliveries.length : s.performanceScore / 100

    const delayValues = [...deliveries, ...delays].map((e) => delayDays(e.metadata)).filter((d) => d > 0)
    const avgDelayDays = delayValues.length
      ? delayValues.reduce((a, b) => a + b, 0) / delayValues.length
      : 0

    const costs = orders.map((e) => orderCost(e.metadata)).filter((c) => c > 0)
    const costMean = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0
    const costStd = costs.length > 1
      ? Math.sqrt(costs.reduce((sum, c) => sum + (c - costMean) ** 2, 0) / costs.length)
      : 0
    const costVarianceCoefficient = costMean > 0 ? costStd / costMean : 0

    return {
      supplierId: s.id,
      supplierName: s.name,
      onTimeDeliveryRate,
      avgDelayDays,
      costVarianceCoefficient,
      orderCount: orders.length,
      delayCount: delays.length,
    }
  })
}

export function supplierFeaturesToRow(v: SupplierFeatureVector): Record<string, number | string | boolean | null> {
  return {
    supplierName: v.supplierName,
    onTimeDeliveryRate: v.onTimeDeliveryRate,
    avgDelayDays: v.avgDelayDays,
    costVarianceCoefficient: v.costVarianceCoefficient,
    orderCount: v.orderCount,
    delayCount: v.delayCount,
  }
}
