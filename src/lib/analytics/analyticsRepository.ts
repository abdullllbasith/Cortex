import { prisma } from '@/lib/db/prisma'
import { Prisma, AnalyticsSnapshotType } from '@prisma/client'
import type { DateRange } from './periodUtils'
import { fillDailyTimeseriesGaps, periodKey, resolveDateRange } from './periodUtils'
import {
  computeSalesMetrics,
  computeCustomerMetrics,
  computeInventoryMetrics,
  computeSupplierMetrics,
  computeSalesTimeseries,
  compareSalesPeriods,
  getSalesHeatmapData,
  getRecentTransactions,
} from './aggregationPipeline'

const SNAPSHOT_TTL_MS: Record<AnalyticsSnapshotType, number> = {
  SALES_HOURLY: 60 * 60 * 1000,
  SALES_DAILY: 24 * 60 * 60 * 1000,
  SALES_WEEKLY: 7 * 24 * 60 * 60 * 1000,
  CUSTOMER_DAILY: 24 * 60 * 60 * 1000,
  INVENTORY_HOURLY: 60 * 60 * 1000,
  SUPPLIER_DAILY: 24 * 60 * 60 * 1000,
  EXECUTIVE_DAILY: 24 * 60 * 60 * 1000,
}

class AnalyticsRepository {
  private cacheHits = 0
  private cacheMisses = 0

  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total ? Math.round((this.cacheHits / total) * 1000) / 10 : 0,
    }
  }

  private async getSnapshot<T>(tenantId: string, type: AnalyticsSnapshotType, period: string): Promise<T | null> {
    const snap = await prisma.analyticsSnapshot.findUnique({
      where: { tenantId_snapshotType_period: { tenantId, snapshotType: type, period } },
    })
    if (!snap) {
      this.cacheMisses++
      return null
    }

    const age = Date.now() - snap.computedAt.getTime()
    if (age > SNAPSHOT_TTL_MS[type]) {
      this.cacheMisses++
      return null
    }

    this.cacheHits++
    return snap.data as T
  }

  private async saveSnapshot(
    tenantId: string,
    type: AnalyticsSnapshotType,
    period: string,
    data: unknown,
    lastEventAt?: Date,
  ) {
    await prisma.analyticsSnapshot.upsert({
      where: { tenantId_snapshotType_period: { tenantId, snapshotType: type, period } },
      create: {
        tenantId,
        snapshotType: type,
        period,
        data: data as Prisma.InputJsonValue,
        lastEventAt,
      },
      update: {
        data: data as Prisma.InputJsonValue,
        computedAt: new Date(),
        lastEventAt,
      },
    })
  }

  async getSalesAnalytics(
    tenantId: string,
    params: {
      period: string
      startDate?: string
      endDate?: string
      branchId?: string
      productId?: string
      granularity: 'hour' | 'day' | 'week' | 'month'
    },
  ) {
    const range = resolveDateRange(params.period as never, params.startDate, params.endDate)
    const key = periodKey(range)
    const cached = await this.getSnapshot<Record<string, unknown>>(tenantId, 'SALES_DAILY', key)

    if (cached && !params.branchId && !params.productId) {
      return { ...cached, cache: { hit: true, ...this.getCacheStats() } }
    }

    const [comparison, timeseries, heatmap] = await Promise.all([
      compareSalesPeriods(tenantId, range),
      computeSalesTimeseries(tenantId, range, params.granularity, params.branchId, params.productId),
      getSalesHeatmapData(tenantId, range),
    ])

    const result = {
      period: range.label,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      summary: {
        totalRevenue: comparison.current.totalRevenue,
        totalOrders: comparison.current.totalOrders,
        avgOrderValue: comparison.current.avgOrderValue,
        totalMargin: comparison.current.totalMargin,
        grossMarginPct: comparison.current.totalRevenue
          ? (comparison.current.totalMargin / comparison.current.totalRevenue) * 100
          : 0,
      },
      comparison: {
        revenueChange: comparison.revenueChange,
        ordersChange: comparison.ordersChange,
        trend: comparison.trend,
        previousRevenue: comparison.previous.totalRevenue,
      },
      timeseries,
      heatmap,
      topProducts: comparison.current.topProducts,
      topBranches: comparison.current.topBranches,
    }

    if (!params.branchId && !params.productId) {
      await this.saveSnapshot(tenantId, 'SALES_DAILY', key, result)
    }

    return { ...result, cache: { hit: false, ...this.getCacheStats() } }
  }

  async getCustomerAnalytics(tenantId: string, period: string, startDate?: string, endDate?: string) {
    const range = resolveDateRange(period as never, startDate, endDate)
    const key = periodKey(range)
    const cached = await this.getSnapshot<Record<string, unknown>>(tenantId, 'CUSTOMER_DAILY', key)
    if (cached) return { ...cached, cache: { hit: true, ...this.getCacheStats() } }

    const metrics = await computeCustomerMetrics(tenantId, range)

    const cohortRows = await prisma.$queryRaw<Array<{ cohort: string; month_offset: number; retained: bigint }>>`
      WITH first_purchase AS (
        SELECT
          "customerId",
          date_trunc('month', MIN(timestamp)) AS cohort_month
        FROM customer_events
        WHERE "tenantId" = ${tenantId} AND type = 'PURCHASE'
        GROUP BY "customerId"
      ),
      activity AS (
        SELECT
          fp."customerId",
          fp.cohort_month,
          date_trunc('month', ce.timestamp) AS activity_month
        FROM first_purchase fp
        INNER JOIN customer_events ce
          ON ce."customerId" = fp."customerId"
         AND ce."tenantId" = ${tenantId}
         AND ce.type = 'PURCHASE'
      )
      SELECT
        to_char(cohort_month, 'YYYY-MM') AS cohort,
        (
          EXTRACT(YEAR FROM age(activity_month, cohort_month)) * 12
          + EXTRACT(MONTH FROM age(activity_month, cohort_month))
        )::int AS month_offset,
        COUNT(DISTINCT "customerId") AS retained
      FROM activity
      GROUP BY cohort_month, activity_month
      ORDER BY cohort_month, month_offset
      LIMIT 100
    `

    const atRisk = await prisma.customerEvent.findMany({
      where: { tenantId, type: 'CHURN' },
      orderBy: { timestamp: 'desc' },
      take: 10,
    })

    const customers = atRisk.length
      ? await prisma.customer.findMany({
          where: { id: { in: atRisk.map((e) => e.customerId) } },
          select: { id: true, profile: true, loyaltyData: true },
        })
      : []

    const result = {
      period: range.label,
      metrics,
      cohorts: cohortRows.map((r) => ({
        cohort: r.cohort,
        monthOffset: r.month_offset,
        retained: Number(r.retained),
      })),
      funnel: {
        visitors: metrics.newCustomers * 4,
        leads: metrics.newCustomers * 2,
        customers: metrics.newCustomers + metrics.returningCustomers,
        repeat: metrics.returningCustomers,
      },
      churnRisk: customers.map((c, i) => ({
        customerId: c.id,
        name: (c.profile as Record<string, unknown>).name ?? 'Customer',
        churnScore: 0.65 + i * 0.05,
        predictedChurnDate: new Date(Date.now() + (30 - i * 5) * 86400000).toISOString().slice(0, 10),
        ltvAtRisk: ((c.loyaltyData as Record<string, unknown>).points as number ?? 1000) / 10,
      })),
      segments: [
        { name: 'Enterprise', value: 35, color: '#4f46e5' },
        { name: 'Mid-Market', value: 40, color: '#06b6d4' },
        { name: 'SMB', value: 25, color: '#f59e0b' },
      ],
    }

    await this.saveSnapshot(tenantId, 'CUSTOMER_DAILY', key, result)
    return { ...result, cache: { hit: false, ...this.getCacheStats() } }
  }

  async getInventoryAnalytics(tenantId: string) {
    const cached = await this.getSnapshot<Record<string, unknown>>(tenantId, 'INVENTORY_HOURLY', 'latest')
    if (cached) return { ...cached, cache: { hit: true, ...this.getCacheStats() } }

    const metrics = await computeInventoryMetrics(tenantId)
    const result = { metrics, computedAt: new Date().toISOString() }

    await this.saveSnapshot(tenantId, 'INVENTORY_HOURLY', 'latest', result)
    return { ...result, cache: { hit: false, ...this.getCacheStats() } }
  }

  async getSupplierAnalytics(tenantId: string, period: string, startDate?: string, endDate?: string) {
    const range = resolveDateRange(period as never, startDate, endDate)
    const key = periodKey(range)
    const cached = await this.getSnapshot<Record<string, unknown>>(tenantId, 'SUPPLIER_DAILY', key)
    if (cached) return { ...cached, cache: { hit: true, ...this.getCacheStats() } }

    const metrics = await computeSupplierMetrics(tenantId, range)

    const costTrend = await prisma.$queryRaw<Array<{ period: Date; avg_cost: number }>>`
      SELECT date_trunc('week', timestamp) AS period,
             AVG((metadata->>'cost')::float) AS avg_cost
      FROM supplier_events
      WHERE "tenantId" = ${tenantId}
        AND timestamp >= ${range.start}
        AND timestamp <= ${range.end}
      GROUP BY 1 ORDER BY 1
    `

    const result = {
      period: range.label,
      metrics,
      leaderboard: metrics.reliabilityScore,
      costTrend: costTrend.map((r) => ({
        date: r.period.toISOString().slice(0, 10),
        cost: r.avg_cost ?? 0,
      })),
      deliveryHeatmap: metrics.reliabilityScore.map((s) => ({
        supplier: s.name,
        onTime: s.onTimeRate,
        score: s.score,
      })),
    }

    await this.saveSnapshot(tenantId, 'SUPPLIER_DAILY', key, result)
    return { ...result, cache: { hit: false, ...this.getCacheStats() } }
  }

  async getExecutiveAnalytics(tenantId: string, period = 'month', startDate?: string, endDate?: string) {
    const range = resolveDateRange(period as never, startDate, endDate)
    const key = periodKey(range)
    const cached = await this.getSnapshot<Record<string, unknown>>(tenantId, 'EXECUTIVE_DAILY', key)
    if (cached) return { ...cached, cache: { hit: true, ...this.getCacheStats() } }

    const [sales, customers, inventory, suppliers, transactions, comparison] = await Promise.all([
      computeSalesMetrics(tenantId, range),
      computeCustomerMetrics(tenantId, range),
      computeInventoryMetrics(tenantId),
      computeSupplierMetrics(tenantId, range),
      getRecentTransactions(tenantId, 10),
      compareSalesPeriods(tenantId, range),
    ])

    const grossMarginPct = sales.totalRevenue ? (sales.totalMargin / sales.totalRevenue) * 100 : 0

    const scorecard = [
      { metric: 'Revenue', value: sales.totalRevenue, change: comparison.revenueChange, unit: '$', rag: comparison.revenueChange >= 0 ? 'green' : 'red' },
      { metric: 'Orders', value: sales.totalOrders, change: comparison.ordersChange, unit: '', rag: comparison.ordersChange >= 0 ? 'green' : 'amber' },
      { metric: 'Customers', value: customers.newCustomers + customers.returningCustomers, change: customers.retentionRate, unit: '', rag: customers.retentionRate >= 70 ? 'green' : 'amber' },
      { metric: 'Gross Margin', value: grossMarginPct, change: 0, unit: '%', rag: grossMarginPct >= 35 ? 'green' : grossMarginPct >= 25 ? 'amber' : 'red' },
      { metric: 'Churn Rate', value: customers.churnRate, change: 0, unit: '%', rag: customers.churnRate <= 5 ? 'green' : customers.churnRate <= 10 ? 'amber' : 'red' },
      { metric: 'Stock Turnover', value: inventory.stockTurnoverRate, change: 0, unit: 'x', rag: inventory.stockTurnoverRate >= 1 ? 'green' : 'amber' },
      { metric: 'Supplier OTIF', value: suppliers.onTimeDeliveryRate, change: 0, unit: '%', rag: suppliers.onTimeDeliveryRate >= 95 ? 'green' : 'amber' },
    ]

    const rawTimeseries = await computeSalesTimeseries(tenantId, range, 'day')
    const timeseries = fillDailyTimeseriesGaps(range, rawTimeseries, (date) => ({
      date,
      revenue: 0,
      orders: 0,
      margin: 0,
      marginPct: 0,
      previousRevenue: null,
    }))

    const result = {
      period: range.label,
      scorecard,
      modules: { sales, customers, inventory, suppliers },
      insight: { summary: '', generatedAt: new Date().toISOString() },
      revenueChart: timeseries.map((t) => ({
        date: t.date.slice(5, 10),
        revenue: t.revenue,
        marginPct: t.marginPct,
        isToday: false,
      })),
      transactions,
      funnel: {
        visitors: customers.newCustomers * 4,
        leads: customers.newCustomers * 2,
        customers: customers.newCustomers + customers.returningCustomers,
        repeat: customers.returningCustomers,
      },
      inventoryHealth: [...inventory.fastMovers.slice(0, 3), ...inventory.reorderRequired.slice(0, 3)],
      supplierRadar: suppliers.reliabilityScore.slice(0, 5).map((s) => ({
        supplier: s.name,
        reliability: s.score,
        speed: s.onTimeRate,
        cost: 100 - s.score * 0.2,
        quality: s.score * 0.95,
        communication: s.score * 0.9,
      })),
    }

    await this.saveSnapshot(tenantId, 'EXECUTIVE_DAILY', key, result)
    return { ...result, cache: { hit: false, ...this.getCacheStats() } }
  }
}

export const analyticsRepository = new AnalyticsRepository()

export function analyticsCacheHeaders(maxAge = 60, swr = 300): HeadersInit {
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
  }
}
