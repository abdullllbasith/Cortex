import { prisma } from '@/lib/db/prisma'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export interface SupplierDeliveryMetrics {
  onTimeDeliveryRate: number | null
  avgDelayDays: number | null
  costVariancePercent: number | null
  sampleSize: number
}

/** On-time %, avg delay days, and PO cost variance from completed goods receipts vs PO expected delivery. */
export async function computeSupplierDeliveryMetrics(
  tenantId: string,
  supplierId: string,
): Promise<SupplierDeliveryMetrics> {
  const receipts = await prisma.goodsReceipt.findMany({
    where: {
      tenantId,
      status: 'COMPLETE',
      receivedAt: { not: null },
      purchaseOrder: { supplierId },
    },
    select: {
      receivedAt: true,
      purchaseOrder: {
        select: { expectedDelivery: true, grandTotal: true },
      },
    },
    orderBy: { receivedAt: 'desc' },
    take: 200,
  })

  if (receipts.length === 0) {
    return { onTimeDeliveryRate: null, avgDelayDays: null, costVariancePercent: null, sampleSize: 0 }
  }

  let onTime = 0
  let measured = 0
  let totalDelayDays = 0
  let lateCount = 0
  const costs: number[] = []

  for (const receipt of receipts) {
    const received = receipt.receivedAt!
    const expected = receipt.purchaseOrder.expectedDelivery
    costs.push(toNumber(receipt.purchaseOrder.grandTotal))

    if (expected) {
      measured++
      const delayMs = received.getTime() - expected.getTime()
      if (delayMs <= 0) onTime++
      else {
        lateCount++
        totalDelayDays += delayMs / 86_400_000
      }
    } else {
      measured++
      onTime++
    }
  }

  const onTimeDeliveryRate = measured > 0 ? Math.round((onTime / measured) * 1000) / 10 : null
  const avgDelayDays = lateCount > 0 ? Math.round((totalDelayDays / lateCount) * 10) / 10 : 0

  let costVariancePercent: number | null = null
  if (costs.length >= 2) {
    const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length
    const latest = costs[0]
    if (avg > 0) {
      costVariancePercent = Math.round(((latest - avg) / avg) * 1000) / 10
    }
  }

  return {
    onTimeDeliveryRate,
    avgDelayDays: lateCount > 0 ? avgDelayDays : null,
    costVariancePercent,
    sampleSize: receipts.length,
  }
}

export function performanceScoreToStars(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 0
  return Math.min(5, Math.max(1, Math.round(score / 20)))
}
