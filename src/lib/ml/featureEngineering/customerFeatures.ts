import { CustomerEventType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { addDays, startOfDay } from '../utils'

const WINDOW_DAYS = 90

export interface CustomerFeatureVector {
  customerId: string
  customerName: string
  recencyDays: number
  frequency90d: number
  monetary90d: number
  rfmScore: number
  gapRatio: number
  frequencyDrop: number
  complaintCount: number
  churnIndicator: number
}

function customerName(profile: unknown): string {
  const p = profile as { name?: string; company?: string }
  return p.name ?? p.company ?? 'Unknown'
}

function purchaseAmount(metadata: unknown, type: CustomerEventType): number {
  if (type !== CustomerEventType.PURCHASE) return 0
  const m = metadata as { amount?: number; revenue?: number }
  return m.amount ?? m.revenue ?? 0
}

export async function extractCustomerFeatures(tenantId: string): Promise<CustomerFeatureVector[]> {
  const now = startOfDay(new Date())
  const windowStart = addDays(now, -WINDOW_DAYS)
  const priorStart = addDays(windowStart, -WINDOW_DAYS)

  const customers = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true, profile: true },
  })

  const events = await prisma.customerEvent.findMany({
    where: {
      tenantId,
      timestamp: { gte: priorStart },
    },
    orderBy: { timestamp: 'asc' },
  })

  const byCustomer = new Map<string, typeof events>()
  for (const e of events) {
    const list = byCustomer.get(e.customerId) ?? []
    list.push(e)
    byCustomer.set(e.customerId, list)
  }

  return customers.map((c) => {
    const evts = byCustomer.get(c.id) ?? []
    const purchases = evts.filter((e) => e.type === CustomerEventType.PURCHASE)
    const recentPurchases = purchases.filter((e) => e.timestamp >= windowStart)
    const priorPurchases = purchases.filter((e) => e.timestamp >= priorStart && e.timestamp < windowStart)

    const lastPurchase = purchases[purchases.length - 1]
    const recencyDays = lastPurchase
      ? Math.floor((now.getTime() - lastPurchase.timestamp.getTime()) / 86400000)
      : 999

    const frequency90d = recentPurchases.length
    const monetary90d = recentPurchases.reduce((s, e) => s + purchaseAmount(e.metadata, e.type), 0)

    const priorFreq = priorPurchases.length || 1
    const frequencyDrop = Math.max(0, (priorFreq - frequency90d) / priorFreq)

    const gaps: number[] = []
    for (let i = 1; i < purchases.length; i++) {
      gaps.push(
        (purchases[i]!.timestamp.getTime() - purchases[i - 1]!.timestamp.getTime()) / 86400000,
      )
    }
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 90
    const gapRatio = avgGap > 0 ? recencyDays / avgGap : recencyDays / 90

    const complaintCount = evts.filter((e) => e.type === CustomerEventType.COMPLAINT).length

    const rScore = recencyDays <= 30 ? 5 : recencyDays <= 60 ? 3 : 1
    const fScore = frequency90d >= 5 ? 5 : frequency90d >= 2 ? 3 : 1
    const mScore = monetary90d >= 10000 ? 5 : monetary90d >= 2000 ? 3 : 1
    const rfmScore = rScore + fScore + mScore

    const churnIndicator = Math.min(
      1,
      gapRatio * 0.4 + frequencyDrop * 0.35 + Math.min(complaintCount / 3, 1) * 0.25,
    )

    return {
      customerId: c.id,
      customerName: customerName(c.profile),
      recencyDays,
      frequency90d,
      monetary90d,
      rfmScore,
      gapRatio,
      frequencyDrop,
      complaintCount,
      churnIndicator,
    }
  })
}

export function customerFeaturesToRow(v: CustomerFeatureVector): Record<string, number | string | boolean | null> {
  return {
    customerName: v.customerName,
    recencyDays: v.recencyDays,
    frequency90d: v.frequency90d,
    monetary90d: v.monetary90d,
    rfmScore: v.rfmScore,
    gapRatio: v.gapRatio,
    frequencyDrop: v.frequencyDrop,
    complaintCount: v.complaintCount,
    churnIndicator: v.churnIndicator,
  }
}
