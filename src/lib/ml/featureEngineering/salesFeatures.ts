import { prisma } from '@/lib/db/prisma'
import type { DailySalesFeatures } from '../types'
import { addDays, dateKey, isHoliday, startOfDay } from '../utils'

const LOOKBACK_DAYS = 90

function rollingAvg(values: number[], window: number, endIdx: number): number {
  const start = Math.max(0, endIdx - window + 1)
  const slice = values.slice(start, endIdx + 1)
  if (!slice.length) return 0
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function lagValue(values: number[], idx: number, lag: number): number {
  const i = idx - lag
  return i >= 0 ? values[i]! : 0
}

export async function extractSalesFeatures(tenantId: string): Promise<DailySalesFeatures[]> {
  const end = startOfDay(new Date())
  const start = addDays(end, -LOOKBACK_DAYS)

  const events = await prisma.salesEvent.findMany({
    where: { tenantId, timestamp: { gte: start, lte: end } },
    select: {
      revenue: true,
      timestamp: true,
      branchId: true,
      productId: true,
    },
  })

  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, catalog: true },
  })

  const categoryByProduct = new Map<string, string>()
  for (const p of products) {
    const cat = (p.catalog as { category?: string })?.category?.toLowerCase() ?? 'other'
    categoryByProduct.set(p.id, cat)
  }

  const dailyRevenue = new Map<string, number>()
  const dailyCategory = new Map<string, Record<string, number>>()
  const dailyBranch = new Map<string, number>()

  for (const e of events) {
    const key = dateKey(e.timestamp)
    dailyRevenue.set(key, (dailyRevenue.get(key) ?? 0) + e.revenue)

    if (e.productId) {
      const cat = categoryByProduct.get(e.productId) ?? 'other'
      const cats = dailyCategory.get(key) ?? {}
      cats[cat] = (cats[cat] ?? 0) + e.revenue
      dailyCategory.set(key, cats)
    }

    if (e.branchId) {
      dailyBranch.set(key, (dailyBranch.get(key) ?? 0) + e.revenue)
    }
  }

  const days: DailySalesFeatures[] = []
  const revenueSeries: number[] = []

  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    const d = addDays(start, i)
    const key = dateKey(d)
    const revenue = dailyRevenue.get(key) ?? 0
    revenueSeries.push(revenue)

    const idx = revenueSeries.length - 1
    const cats = dailyCategory.get(key) ?? {}

    days.push({
      date: key,
      revenue,
      lag1d: lagValue(revenueSeries, idx, 1),
      lag7d: lagValue(revenueSeries, idx, 7),
      lag14d: lagValue(revenueSeries, idx, 14),
      lag30d: lagValue(revenueSeries, idx, 30),
      rollingAvg7d: rollingAvg(revenueSeries, 7, idx),
      rollingAvg30d: rollingAvg(revenueSeries, 30, idx),
      dayOfWeek: d.getUTCDay(),
      month: d.getUTCMonth() + 1,
      isHoliday: isHoliday(d),
      categoryElectronics: cats.electronics ?? 0,
      categoryHardware: cats.hardware ?? 0,
      categorySoftware: cats.software ?? 0,
      branchAggregate: dailyBranch.get(key) ?? revenue,
    })
  }

  return days
}

/** Flatten latest day features for FeatureSnapshot storage */
export function salesFeaturesToRow(latest: DailySalesFeatures): Record<string, number | string | boolean | null> {
  return {
    date: latest.date,
    revenue: latest.revenue,
    lag1d: latest.lag1d,
    lag7d: latest.lag7d,
    lag14d: latest.lag14d,
    lag30d: latest.lag30d,
    rollingAvg7d: latest.rollingAvg7d,
    rollingAvg30d: latest.rollingAvg30d,
    dayOfWeek: latest.dayOfWeek,
    month: latest.month,
    isHoliday: latest.isHoliday,
    categoryElectronics: latest.categoryElectronics,
    categoryHardware: latest.categoryHardware,
    categorySoftware: latest.categorySoftware,
    branchAggregate: latest.branchAggregate,
  }
}

export async function extractSalesFeatureRows(tenantId: string) {
  const series = await extractSalesFeatures(tenantId)
  const latest = series[series.length - 1]
  if (!latest) return { entityId: 'tenant', features: {}, series: [] as DailySalesFeatures[] }

  return {
    entityId: 'tenant',
    features: salesFeaturesToRow(latest),
    series,
  }
}
