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

export async function extractCustomerFeatures(tenantId: string): Promise<CustomerFeatureVector[]> {
  const now = startOfDay(new Date())
  const windowStart = addDays(now, -WINDOW_DAYS)
  const priorStart = addDays(windowStart, -WINDOW_DAYS)

  const events = await prisma.salesEvent.findMany({
    where: {
      tenantId,
      customerId: { not: null },
      timestamp: { gte: priorStart },
    },
    orderBy: { timestamp: 'asc' },
  })

  const contactIds = [...new Set(events.map((e) => e.customerId).filter(Boolean) as string[])]
  const contacts = contactIds.length
    ? await prisma.crmContact.findMany({
        where: { tenantId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, company: true },
      })
    : []
  const contactNames = new Map(
    contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.company || 'Contact']),
  )

  const byCustomer = new Map<string, typeof events>()
  for (const e of events) {
    if (!e.customerId) continue
    const list = byCustomer.get(e.customerId) ?? []
    list.push(e)
    byCustomer.set(e.customerId, list)
  }

  return contactIds.map((customerId) => {
    const evts = byCustomer.get(customerId) ?? []
    const recent = evts.filter((e) => e.timestamp >= windowStart)
    const prior = evts.filter((e) => e.timestamp >= priorStart && e.timestamp < windowStart)

    const lastPurchase = evts[evts.length - 1]
    const recencyDays = lastPurchase
      ? Math.floor((now.getTime() - lastPurchase.timestamp.getTime()) / 86400000)
      : 999

    const frequency90d = recent.length
    const monetary90d = recent.reduce((s, e) => s + e.revenue, 0)

    const priorFreq = prior.length || 1
    const frequencyDrop = Math.max(0, (priorFreq - frequency90d) / priorFreq)

    const gaps: number[] = []
    for (let i = 1; i < evts.length; i++) {
      gaps.push((evts[i]!.timestamp.getTime() - evts[i - 1]!.timestamp.getTime()) / 86400000)
    }
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 90
    const gapRatio = avgGap > 0 ? recencyDays / avgGap : recencyDays / 90

    const rScore = recencyDays <= 30 ? 5 : recencyDays <= 60 ? 3 : 1
    const fScore = frequency90d >= 5 ? 5 : frequency90d >= 2 ? 3 : 1
    const mScore = monetary90d >= 10000 ? 5 : monetary90d >= 2000 ? 3 : 1
    const rfmScore = rScore + fScore + mScore

    const churnIndicator = Math.min(1, gapRatio * 0.45 + frequencyDrop * 0.55)

    return {
      customerId,
      customerName: contactNames.get(customerId) ?? 'Contact',
      recencyDays,
      frequency90d,
      monetary90d,
      rfmScore,
      gapRatio,
      frequencyDrop,
      complaintCount: 0,
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
