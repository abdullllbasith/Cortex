import { prisma } from '@/lib/db/prisma'
import type { DateRange } from './periodUtils'
import { resolveDateRange, type AnalyticsPeriod } from './periodUtils'

export interface SalesPeriodMetrics {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalMargin: number
  totalCost: number
}

export interface SalesTimeseriesPoint {
  date: string
  revenue: number
  orderCount: number
  avgOrderValue: number
  margin: number
  marginPct: number
}

function toNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber()
  }
  return Number(value)
}

function truncUnit(granularity: 'hour' | 'day' | 'week' | 'month'): 'hour' | 'day' | 'week' | 'month' {
  return granularity
}

function formatBucket(date: Date, granularity: 'hour' | 'day' | 'week' | 'month'): string {
  const d = new Date(date)
  if (granularity === 'hour') return d.toISOString().slice(0, 13) + ':00:00.000Z'
  if (granularity === 'day') return d.toISOString().slice(0, 10)
  if (granularity === 'week') {
    const day = d.getUTCDay()
    d.setUTCDate(d.getUTCDate() - day)
    return d.toISOString().slice(0, 10)
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function querySalesMetrics(tenantId: string, range: DateRange): Promise<SalesPeriodMetrics> {
  const rows = await prisma.$queryRaw<Array<{
    total_revenue: number
    total_orders: bigint
    total_margin: number
    total_cost: number
  }>>`
    SELECT
      COALESCE(SUM(revenue), 0)::float AS total_revenue,
      COUNT(*) AS total_orders,
      COALESCE(SUM(margin), 0)::float AS total_margin,
      COALESCE(SUM(cost), 0)::float AS total_cost
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
  `

  const summary = rows[0] ?? { total_revenue: 0, total_orders: BigInt(0), total_margin: 0, total_cost: 0 }
  const totalOrders = Number(summary.total_orders)

  return {
    totalRevenue: summary.total_revenue,
    totalOrders,
    avgOrderValue: totalOrders ? summary.total_revenue / totalOrders : 0,
    totalMargin: summary.total_margin,
    totalCost: summary.total_cost,
  }
}

export async function querySalesTimeseries(
  tenantId: string,
  range: DateRange,
  granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  branchId?: string,
  productId?: string,
): Promise<SalesTimeseriesPoint[]> {
  const unit = truncUnit(granularity)

  // Bucket in UTC so serverless (Vercel) chart keys match resolveDateRange / fillDailyTimeseriesGaps.
  if (branchId && productId) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; revenue: number; order_count: bigint; margin: number }>>`
      SELECT date_trunc(${unit}, timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
             COALESCE(SUM(revenue), 0)::float AS revenue,
             COUNT(*) AS order_count,
             COALESCE(SUM(margin), 0)::float AS margin
      FROM sales_events
      WHERE "tenantId" = ${tenantId}
        AND timestamp >= ${range.start} AND timestamp <= ${range.end}
        AND "branchId" = ${branchId} AND "productId" = ${productId}
      GROUP BY 1 ORDER BY 1 ASC`
    return mapTimeseriesRows(rows, granularity)
  }

  if (branchId) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; revenue: number; order_count: bigint; margin: number }>>`
      SELECT date_trunc(${unit}, timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
             COALESCE(SUM(revenue), 0)::float AS revenue,
             COUNT(*) AS order_count,
             COALESCE(SUM(margin), 0)::float AS margin
      FROM sales_events
      WHERE "tenantId" = ${tenantId}
        AND timestamp >= ${range.start} AND timestamp <= ${range.end}
        AND "branchId" = ${branchId}
      GROUP BY 1 ORDER BY 1 ASC`
    return mapTimeseriesRows(rows, granularity)
  }

  if (productId) {
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; revenue: number; order_count: bigint; margin: number }>>`
      SELECT date_trunc(${unit}, timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
             COALESCE(SUM(revenue), 0)::float AS revenue,
             COUNT(*) AS order_count,
             COALESCE(SUM(margin), 0)::float AS margin
      FROM sales_events
      WHERE "tenantId" = ${tenantId}
        AND timestamp >= ${range.start} AND timestamp <= ${range.end}
        AND "productId" = ${productId}
      GROUP BY 1 ORDER BY 1 ASC`
    return mapTimeseriesRows(rows, granularity)
  }

  const rows = await prisma.$queryRaw<Array<{ bucket: Date; revenue: number; order_count: bigint; margin: number }>>`
    SELECT date_trunc(${unit}, timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
           COALESCE(SUM(revenue), 0)::float AS revenue,
           COUNT(*) AS order_count,
           COALESCE(SUM(margin), 0)::float AS margin
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start} AND timestamp <= ${range.end}
    GROUP BY 1 ORDER BY 1 ASC`
  return mapTimeseriesRows(rows, granularity)
}

function mapTimeseriesRows(
  rows: Array<{ bucket: Date; revenue: number; order_count: bigint; margin: number }>,
  granularity: 'hour' | 'day' | 'week' | 'month',
): SalesTimeseriesPoint[] {
  return rows.map((row) => {
    const orderCount = Number(row.order_count)
    const revenue = row.revenue
    return {
      date: formatBucket(row.bucket, granularity),
      revenue,
      orderCount,
      avgOrderValue: orderCount ? revenue / orderCount : 0,
      margin: row.margin,
      marginPct: revenue ? (row.margin / revenue) * 100 : 0,
    }
  })
}

export async function queryTopCustomers(
  tenantId: string,
  range: DateRange,
  limit = 10,
): Promise<Array<{ customerId: string; name: string; revenue: number; orderCount: number }>> {
  const rows = await prisma.$queryRaw<Array<{
    customer_id: string
    revenue: number
    order_count: bigint
  }>>`
    SELECT "customerId" AS customer_id,
           SUM(revenue)::float AS revenue,
           COUNT(*) AS order_count
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND "customerId" IS NOT NULL
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
    GROUP BY "customerId"
    ORDER BY revenue DESC
    LIMIT ${limit}
  `

  const ids = rows.map((r) => r.customer_id)
  const contacts = ids.length
    ? await prisma.crmContact.findMany({
        where: { id: { in: ids }, tenantId },
        select: { id: true, firstName: true, lastName: true, company: true },
      })
    : []
  const nameMap = new Map(
    contacts.map((c) => [
      c.id,
      c.company?.trim() ||
        `${c.firstName} ${c.lastName}`.trim() ||
        'Customer',
    ]),
  )

  return rows.map((r) => ({
    customerId: r.customer_id,
    name: nameMap.get(r.customer_id) ?? 'Customer',
    revenue: r.revenue,
    orderCount: Number(r.order_count),
  }))
}

export async function queryTodaySales(tenantId: string) {
  const range = resolveDateRange('today')
  return querySalesMetrics(tenantId, range)
}

export async function queryExpensesForPeriod(tenantId: string, range: DateRange) {
  const [poRows, cogsRows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM("grandTotal"), 0)::float AS total
      FROM purchase_orders
      WHERE "tenantId" = ${tenantId}
        AND status IN ('RECEIVED', 'PARTIAL', 'ACKNOWLEDGED', 'SENT')
        AND "createdAt" >= ${range.start}
        AND "createdAt" <= ${range.end}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(cost), 0)::float AS total
      FROM sales_events
      WHERE "tenantId" = ${tenantId}
        AND timestamp >= ${range.start}
        AND timestamp <= ${range.end}
    `,
  ])

  const purchaseOrders = poRows[0]?.total ?? 0
  const cogs = cogsRows[0]?.total ?? 0
  return {
    totalExpenses: purchaseOrders + cogs,
    purchaseOrders,
    cogs,
    breakdown: [
      { category: 'COGS', amount: cogs, percent: 0 },
      { category: 'Purchase Orders', amount: purchaseOrders, percent: 0 },
    ],
  }
}

export function resolveAnalyticsPeriod(period: string): DateRange {
  return resolveDateRange(period as AnalyticsPeriod)
}

export { toNumber }
