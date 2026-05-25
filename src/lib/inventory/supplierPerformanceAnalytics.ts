import { prisma } from '@/lib/db/prisma'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function last12MonthKeys(): string[] {
  const keys: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    keys.push(monthKey(m))
  }
  return keys
}

function sumPoItemsCost(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, line) => {
    const row = line as Record<string, unknown>
    const qty = Number(row.quantity ?? row.qty ?? 0)
    const cost = Number(row.unitCost ?? row.cost ?? 0)
    return sum + qty * cost
  }, 0)
}

export interface SupplierPerformanceAnalytics {
  currentScore: number
  onTimeRate: number
  costAccuracy: number
  qualityScore: number
  rating: number
  avgDeliveryDays: number
  costVariance: number
  onTimeTrend: Array<{ month: string; onTimeRate: number; deliveries: number; late: number }>
  delayTrend: Array<{ month: string; avgDelayDays: number }>
  costVarianceByPo: Array<{
    poId: string
    poNumber: string
    orderedCost: number
    actualCost: number
    variancePct: number
    receivedAt: string | null
  }>
  reliabilityTrend: Array<{ month: string; score: number }>
  totalPos: number
  sampleReceipts: number
}

/** Performance from GoodsReceipt + PurchaseOrder with composite reliability score. */
export async function computeSupplierPerformanceAnalytics(
  tenantId: string,
  supplierId: string,
): Promise<SupplierPerformanceAnalytics> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const [receipts, pos] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where: {
        tenantId,
        status: 'COMPLETE',
        receivedAt: { gte: twelveMonthsAgo, not: null },
        purchaseOrder: { supplierId },
      },
      select: {
        id: true,
        receivedAt: true,
        items: true,
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            grandTotal: true,
            expectedDelivery: true,
            items: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId, supplierId, createdAt: { gte: twelveMonthsAgo } },
      select: { id: true, status: true, createdAt: true },
    }),
  ])

  const monthBuckets = new Map(
    last12MonthKeys().map((k) => [k, { onTime: 0, late: 0, delaySum: 0, delayCount: 0 }]),
  )

  let globalOnTime = 0
  let globalMeasured = 0
  let costAccSum = 0
  let costAccCount = 0
  const costVarianceByPo: SupplierPerformanceAnalytics['costVarianceByPo'] = []

  for (const receipt of receipts) {
    const received = receipt.receivedAt!
    const mk = monthKey(received)
    const bucket = monthBuckets.get(mk) ?? { onTime: 0, late: 0, delaySum: 0, delayCount: 0 }
    const expected = receipt.purchaseOrder.expectedDelivery

    if (expected) {
      globalMeasured++
      const delayDays = (received.getTime() - expected.getTime()) / 86_400_000
      if (delayDays <= 0) {
        globalOnTime++
        bucket.onTime++
      } else {
        bucket.late++
        bucket.delaySum += delayDays
        bucket.delayCount++
      }
    } else {
      globalMeasured++
      globalOnTime++
      bucket.onTime++
    }
    monthBuckets.set(mk, bucket)

    const orderedCost =
      sumPoItemsCost(receipt.purchaseOrder.items) || toNumber(receipt.purchaseOrder.grandTotal)
    const actualCost = sumPoItemsCost(receipt.items) || orderedCost
    const variancePct =
      orderedCost > 0 ? Math.round(((actualCost - orderedCost) / orderedCost) * 1000) / 10 : 0

    costVarianceByPo.push({
      poId: receipt.purchaseOrder.id,
      poNumber: receipt.purchaseOrder.poNumber,
      orderedCost: Math.round(orderedCost * 100) / 100,
      actualCost: Math.round(actualCost * 100) / 100,
      variancePct,
      receivedAt: received.toISOString(),
    })

    const accuracy = orderedCost > 0 ? Math.max(0, 100 - Math.abs(variancePct)) : 100
    costAccSum += accuracy
    costAccCount++
  }

  const onTimeRate = globalMeasured > 0 ? Math.round((globalOnTime / globalMeasured) * 1000) / 10 : 0
  const costAccuracy = costAccCount > 0 ? Math.round((costAccSum / costAccCount) * 10) / 10 : 100

  const receivedRatio = pos.length
    ? (pos.filter((p) => p.status === 'RECEIVED').length / pos.length) * 100
    : 0
  const qualityScore = Math.round(receivedRatio * 10) / 10

  const currentScore = Math.round(
    onTimeRate * 0.5 + costAccuracy * 0.3 + qualityScore * 0.2,
  )

  const onTimeTrend = last12MonthKeys().map((month) => {
    const b = monthBuckets.get(month) ?? { onTime: 0, late: 0, delaySum: 0, delayCount: 0 }
    const total = b.onTime + b.late
    return {
      month,
      onTimeRate: total ? Math.round((b.onTime / total) * 1000) / 10 : onTimeRate,
      deliveries: b.onTime,
      late: b.late,
    }
  })

  const delayTrend = last12MonthKeys().map((month) => {
    const b = monthBuckets.get(month) ?? { onTime: 0, late: 0, delaySum: 0, delayCount: 0 }
    return {
      month,
      avgDelayDays: b.delayCount ? Math.round((b.delaySum / b.delayCount) * 10) / 10 : 0,
    }
  })

  const reliabilityTrend = onTimeTrend.map((p) => ({ month: p.month, score: p.onTimeRate }))

  const avgDeliveryDays =
    delayTrend.filter((d) => d.avgDelayDays > 0).length > 0
      ? Math.round(
          (delayTrend.reduce((s, d) => s + d.avgDelayDays, 0) /
            delayTrend.filter((d) => d.avgDelayDays > 0).length) *
            10,
        ) / 10
      : 0

  const costVariance =
    costVarianceByPo.length > 0
      ? Math.round(
          (costVarianceByPo.reduce((s, p) => s + Math.abs(p.variancePct), 0) /
            costVarianceByPo.length) *
            10,
        ) / 10
      : 0

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { performanceScore: currentScore },
  })

  return {
    currentScore,
    onTimeRate,
    costAccuracy,
    qualityScore,
    rating: Math.round((currentScore / 100) * 5 * 10) / 10,
    avgDeliveryDays,
    costVariance,
    onTimeTrend,
    delayTrend,
    costVarianceByPo: costVarianceByPo.slice(0, 20),
    reliabilityTrend,
    totalPos: pos.length,
    sampleReceipts: receipts.length,
  }
}
