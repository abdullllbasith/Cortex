import { prisma } from '@/lib/db/prisma'
import type { DateRange } from './periodUtils'
import { percentChange, trendDirection } from './periodUtils'

export interface SalesMetrics {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalMargin: number
  topProducts: Array<{ productId: string | null; revenue: number; quantity: number }>
  topBranches: Array<{ branchId: string | null; revenue: number; orders: number }>
}

export interface CustomerMetrics {
  retentionRate: number
  churnRate: number
  avgLifetimeValue: number
  newCustomers: number
  returningCustomers: number
}

export interface InventoryMetrics {
  fastMovers: Array<{ productId: string; name: string; turnoverRate: number }>
  deadStock: Array<{ productId: string; name: string; inventoryLevel: number; daysIdle: number }>
  reorderRequired: Array<{ productId: string; name: string; inventoryLevel: number; reorderPoint: number }>
  stockTurnoverRate: number
}

export interface SupplierMetrics {
  onTimeDeliveryRate: number
  avgDeliveryDays: number
  costVariance: number
  reliabilityScore: Array<{ supplierId: string; name: string; score: number; onTimeRate: number }>
}

export async function computeSalesMetrics(tenantId: string, range: DateRange): Promise<SalesMetrics> {
  const rows = await prisma.$queryRaw<Array<{
    total_revenue: number
    total_orders: bigint
    total_margin: number
  }>>`
    SELECT
      COALESCE(SUM(revenue), 0)::float AS total_revenue,
      COUNT(*) AS total_orders,
      COALESCE(SUM(margin), 0)::float AS total_margin
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
  `

  const topProducts = await prisma.$queryRaw<Array<{
    product_id: string | null
    revenue: number
    quantity: bigint
  }>>`
    SELECT "productId" AS product_id,
           SUM(revenue)::float AS revenue,
           SUM(quantity) AS quantity
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
    GROUP BY "productId"
    ORDER BY revenue DESC
    LIMIT 10
  `

  const topBranches = await prisma.$queryRaw<Array<{
    branch_id: string | null
    revenue: number
    orders: bigint
  }>>`
    SELECT "branchId" AS branch_id,
           SUM(revenue)::float AS revenue,
           COUNT(*) AS orders
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
    GROUP BY "branchId"
    ORDER BY revenue DESC
    LIMIT 10
  `

  const summary = rows[0] ?? { total_revenue: 0, total_orders: BigInt(0), total_margin: 0 }
  const totalOrders = Number(summary.total_orders)

  return {
    totalRevenue: summary.total_revenue,
    totalOrders,
    avgOrderValue: totalOrders ? summary.total_revenue / totalOrders : 0,
    totalMargin: summary.total_margin,
    topProducts: topProducts.map((p) => ({
      productId: p.product_id,
      revenue: p.revenue,
      quantity: Number(p.quantity),
    })),
    topBranches: topBranches.map((b) => ({
      branchId: b.branch_id,
      revenue: b.revenue,
      orders: Number(b.orders),
    })),
  }
}

export async function computeSalesTimeseries(
  tenantId: string,
  range: DateRange,
  granularity: 'hour' | 'day' | 'week' | 'month',
  branchId?: string,
  productId?: string,
) {
  const trunc = granularity === 'hour' ? 'hour' : granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day'

  const events = await prisma.salesEvent.findMany({
    where: {
      tenantId,
      timestamp: { gte: range.start, lte: range.end },
      ...(branchId ? { branchId } : {}),
      ...(productId ? { productId } : {}),
    },
    select: { timestamp: true, revenue: true, margin: true },
    orderBy: { timestamp: 'asc' },
  })

  const buckets = new Map<string, { revenue: number; orders: number; margin: number }>()
  for (const e of events) {
    const key = truncateBucket(e.timestamp, trunc)
    const b = buckets.get(key) ?? { revenue: 0, orders: 0, margin: 0 }
    b.revenue += e.revenue
    b.margin += e.margin
    b.orders += 1
    buckets.set(key, b)
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  let prevRevenue: number | null = null

  return sorted.map(([date, b]) => {
    const row = {
      date,
      revenue: b.revenue,
      orders: b.orders,
      margin: b.margin,
      marginPct: b.revenue ? (b.margin / b.revenue) * 100 : 0,
      previousRevenue: prevRevenue,
    }
    prevRevenue = b.revenue
    return row
  })
}

function truncateBucket(date: Date, trunc: string): string {
  const d = new Date(date)
  if (trunc === 'hour') return d.toISOString().slice(0, 13) + ':00:00.000Z'
  if (trunc === 'day') return d.toISOString().slice(0, 10)
  if (trunc === 'week') {
    const day = d.getUTCDay()
    d.setUTCDate(d.getUTCDate() - day)
    return d.toISOString().slice(0, 10)
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function computeCustomerMetrics(tenantId: string, range: DateRange): Promise<CustomerMetrics> {
  const purchases = await prisma.customerEvent.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      type: 'PURCHASE',
      timestamp: { gte: range.start, lte: range.end },
    },
    _count: { customerId: true },
  })

  const churns = await prisma.customerEvent.count({
    where: { tenantId, type: 'CHURN', timestamp: { gte: range.start, lte: range.end } },
  })

  const newCustomers = await prisma.customerEvent.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      type: 'PURCHASE',
      timestamp: { gte: range.start, lte: range.end },
    },
  })

  const allCustomers = await prisma.customer.count({ where: { tenantId } })
  const returning = purchases.filter((p) => p._count.customerId > 1).length
  const uniqueBuyers = purchases.length

  const revenueRows = await prisma.$queryRaw<Array<{ ltv: number }>>`
    SELECT COALESCE(AVG(sub.total), 0)::float AS ltv
    FROM (
      SELECT "customerId", SUM(revenue) AS total
      FROM sales_events
      WHERE "tenantId" = ${tenantId}
      GROUP BY "customerId"
    ) sub
  `

  return {
    retentionRate: uniqueBuyers ? Math.round((returning / uniqueBuyers) * 1000) / 10 : 0,
    churnRate: allCustomers ? Math.round((churns / allCustomers) * 1000) / 10 : 0,
    avgLifetimeValue: revenueRows[0]?.ltv ?? 0,
    newCustomers: newCustomers.length,
    returningCustomers: returning,
  }
}

export async function computeInventoryMetrics(tenantId: string): Promise<InventoryMetrics> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, name: true, inventoryLevel: true, updatedAt: true },
  })

  const salesByProduct = await prisma.$queryRaw<Array<{ product_id: string; sold: bigint }>>`
    SELECT "productId" AS product_id, SUM(quantity) AS sold
    FROM inventory_events
    WHERE "tenantId" = ${tenantId} AND type = 'SALE'
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY "productId"
  `

  const salesMap = new Map(salesByProduct.map((s) => [s.product_id, Number(s.sold)]))

  const withTurnover = products.map((p) => {
    const sold = salesMap.get(p.id) ?? 0
    const turnoverRate = p.inventoryLevel > 0 ? sold / p.inventoryLevel : sold
    const daysIdle = Math.floor((Date.now() - p.updatedAt.getTime()) / 86400000)
    return { ...p, turnoverRate, daysIdle, sold }
  })

  return {
    fastMovers: withTurnover
      .sort((a, b) => b.turnoverRate - a.turnoverRate)
      .slice(0, 10)
      .map((p) => ({ productId: p.id, name: p.name, turnoverRate: Math.round(p.turnoverRate * 100) / 100 })),
    deadStock: withTurnover
      .filter((p) => p.sold === 0 && p.inventoryLevel > 0)
      .map((p) => ({ productId: p.id, name: p.name, inventoryLevel: p.inventoryLevel, daysIdle: p.daysIdle })),
    reorderRequired: withTurnover
      .filter((p) => p.inventoryLevel < 25)
      .map((p) => ({ productId: p.id, name: p.name, inventoryLevel: p.inventoryLevel, reorderPoint: 25 })),
    stockTurnoverRate:
      withTurnover.length
        ? withTurnover.reduce((s, p) => s + p.turnoverRate, 0) / withTurnover.length
        : 0,
  }
}

export async function computeSupplierMetrics(tenantId: string, range: DateRange): Promise<SupplierMetrics> {
  const suppliers = await prisma.supplier.findMany({
    where: { tenantId },
    select: { id: true, name: true, performanceScore: true },
  })

  const events = await prisma.supplierEvent.groupBy({
    by: ['supplierId', 'type'],
    where: { tenantId, timestamp: { gte: range.start, lte: range.end } },
    _count: { type: true },
  })

  const deliveries = events.filter((e) => e.type === 'DELIVERY').reduce((s, e) => s + e._count.type, 0)
  const delays = events.filter((e) => e.type === 'DELAY').reduce((s, e) => s + e._count.type, 0)
  const total = deliveries + delays

  const reliabilityScore = suppliers.map((s) => {
    const supplierDelays = events.find((e) => e.supplierId === s.id && e.type === 'DELAY')?._count.type ?? 0
    const supplierDeliveries = events.find((e) => e.supplierId === s.id && e.type === 'DELIVERY')?._count.type ?? 0
    const totalEv = supplierDelays + supplierDeliveries
    const onTimeRate = totalEv ? ((supplierDeliveries / totalEv) * 100) : s.performanceScore
    return {
      supplierId: s.id,
      name: s.name,
      score: s.performanceScore,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
    }
  })

  return {
    onTimeDeliveryRate: total ? Math.round((deliveries / total) * 1000) / 10 : 95,
    avgDeliveryDays: 5.2,
    costVariance: 2.3,
    reliabilityScore: reliabilityScore.sort((a, b) => b.score - a.score),
  }
}

export async function compareSalesPeriods(tenantId: string, range: DateRange) {
  const previousRange: DateRange = {
    ...range,
    start: range.previousStart,
    end: range.previousEnd,
    label: 'Previous period',
  }
  const [current, previous] = await Promise.all([
    computeSalesMetrics(tenantId, range),
    computeSalesMetrics(tenantId, previousRange),
  ])

  return {
    current,
    previous,
    revenueChange: percentChange(current.totalRevenue, previous.totalRevenue),
    ordersChange: percentChange(current.totalOrders, previous.totalOrders),
    trend: trendDirection(current.totalRevenue, previous.totalRevenue),
  }
}

export async function getSalesHeatmapData(tenantId: string, range: DateRange) {
  const rows = await prisma.$queryRaw<Array<{ dow: number; hour: number; intensity: bigint }>>`
    SELECT
      EXTRACT(DOW FROM timestamp)::int AS dow,
      EXTRACT(HOUR FROM timestamp)::int AS hour,
      COUNT(*) AS intensity
    FROM sales_events
    WHERE "tenantId" = ${tenantId}
      AND timestamp >= ${range.start}
      AND timestamp <= ${range.end}
    GROUP BY 1, 2
  `

  const grid: Array<{ day: number; hour: number; value: number }> = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const match = rows.find((r) => r.dow === day && r.hour === hour)
      grid.push({ day, hour, value: match ? Number(match.intensity) : 0 })
    }
  }
  return grid
}

export async function getRecentTransactions(tenantId: string, limit = 10) {
  const events = await prisma.salesEvent.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })

  const customerIds = [...new Set(events.map((e) => e.customerId).filter(Boolean))] as string[]
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, profile: true },
      })
    : []

  const customerMap = new Map(customers.map((c) => [c.id, (c.profile as Record<string, unknown>).name ?? 'Customer']))

  return events.map((e) => ({
    id: e.id,
    customer: e.customerId ? customerMap.get(e.customerId) ?? 'Unknown' : 'Walk-in',
    amount: e.revenue,
    margin: e.margin,
    status: 'paid',
    time: e.timestamp.toISOString(),
    items: e.quantity,
    channel: e.channel,
  }))
}
