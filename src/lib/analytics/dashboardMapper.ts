import { prisma } from '@/lib/db/prisma'
import type { ExecutiveAnalyticsData } from '@/lib/analytics/types'
import type { ExecutiveData } from '@/components/dashboard/types'
import { formatDistanceToNow } from 'date-fns'
import { querySalesMetrics } from '@/lib/analytics/salesDataService'
import { resolveDateRange, fillDailyTimeseriesGaps } from '@/lib/analytics/periodUtils'
import { computeSalesTimeseries } from '@/lib/analytics/aggregationPipeline'
import { getLatestInventoryForecasts } from '@/lib/ml/models/inventoryForecaster'
import { getLatestChurnPredictions } from '@/lib/ml/models/customerChurnPredictor'
import { NotificationSeverity } from '@prisma/client'

function relTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })
}

function executionDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt) return '—'
  const end = completedAt ?? new Date()
  const ms = end.getTime() - startedAt.getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function severityFromNotification(severity: NotificationSeverity): ExecutiveData['alerts'][0]['severity'] {
  if (severity === 'CRITICAL' || severity === 'ERROR') return 'danger'
  if (severity === 'WARNING') return 'warning'
  return 'info'
}

export async function mapToDashboardData(
  data: ExecutiveAnalyticsData & { transactions?: Array<Record<string, unknown>> },
  tenantId: string,
  userId?: string,
): Promise<ExecutiveData> {
  const sales = data.modules.sales
  const inventory = data.modules.inventory
  const todayKey = new Date().toISOString().slice(5, 10)
  const todayRange = resolveDateRange('today')
  const weekRange = resolveDateRange('week')

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const [
    agentLogs,
    activeOrderCount,
    runningWorkflowCount,
    aiCallsToday,
    todaySales,
    weekTimeseries,
    notifications,
    inventoryForecasts,
    churnPredictions,
    recentExecutions,
  ] = await Promise.all([
    prisma.agentLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.salesOrder.count({
      where: {
        tenantId,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
    }),
    prisma.workflowExecution.count({
      where: { tenantId, status: 'RUNNING' },
    }),
    prisma.agentLog.count({
      where: {
        tenantId,
        createdAt: { gte: dayStart },
      },
    }),
    querySalesMetrics(tenantId, todayRange),
    computeSalesTimeseries(tenantId, weekRange, 'day'),
    prisma.notification.findMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    getLatestInventoryForecasts(tenantId).catch(() => []),
    getLatestChurnPredictions(tenantId, 'high').catch(() => []),
    prisma.workflowExecution.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { definition: { select: { name: true } } },
    }),
  ])

  const revenueChange = data.scorecard.find((s) => s.metric === 'Revenue')?.change ?? 0
  const ordersChange = data.scorecard.find((s) => s.metric === 'Orders')?.change ?? 0

  const filledWeek = fillDailyTimeseriesGaps(weekRange, weekTimeseries, (date) => ({
    date,
    revenue: 0,
    orderCount: 0,
    orders: 0,
    avgOrderValue: 0,
    margin: 0,
    marginPct: 0,
    previousRevenue: null,
  }))

  const orderSparkline = filledWeek.map((r) => {
    const point = r as { orderCount?: number; orders?: number }
    return point.orderCount ?? point.orders ?? 0
  })

  const alerts: ExecutiveData['alerts'] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    severity: severityFromNotification(n.severity),
    time: relTime(n.createdAt),
  }))

  if (alerts.length === 0 && inventory.reorderRequired.length > 0) {
    for (const p of inventory.reorderRequired.slice(0, 2)) {
      alerts.push({
        id: `stock-${p.productId}`,
        title: `Low stock: ${p.name}`,
        severity: 'warning',
        time: relTime(new Date()),
      })
    }
  }

  const agentActivity: ExecutiveData['agentActivity'] = agentLogs.map((log) => ({
    id: log.id,
    agent: log.agentType.charAt(0) + log.agentType.slice(1).toLowerCase(),
    action: log.action,
    time: relTime(log.createdAt),
    type: log.status === 'FAILURE' ? 'alert' : log.action.toLowerCase().includes('inventory') ? 'inventory' : 'analytics',
  }))

  const recentWorkflows: ExecutiveData['recentWorkflows'] = recentExecutions.map((ex) => ({
    id: ex.id,
    name: ex.definition.name,
    status: ex.status === 'RUNNING' ? 'running' : ex.status === 'FAILED' ? 'failed' : 'success',
    duration: executionDuration(ex.startedAt, ex.completedAt),
    time: relTime(ex.createdAt),
  }))

  const predictions: ExecutiveData['predictions'] = []

  for (const item of inventoryForecasts.filter((i) => i.urgencyLevel !== 'normal').slice(0, 3)) {
    const daysOut = item.predictedStockOutDate
      ? Math.max(1, Math.ceil((new Date(item.predictedStockOutDate).getTime() - Date.now()) / 86400000))
      : 7
    predictions.push({
      id: `inv-${item.productId}`,
      event: `${item.productName} stockout risk`,
      confidence: item.urgencyLevel === 'critical' ? 88 : 72,
      daysOut,
      severity: item.urgencyLevel === 'critical' ? 'danger' : 'warning',
    })
  }

  for (const churn of churnPredictions.slice(0, 2)) {
    predictions.push({
      id: `churn-${churn.customerId}`,
      event: `${churn.customerName} churn risk (${Math.round(churn.churnProbability * 100)}%)`,
      confidence: Math.round(churn.churnProbability * 100),
      daysOut: churn.daysToChurn ?? 30,
      severity: churn.churnRisk === 'high' ? 'danger' : 'warning',
    })
  }

  const rawTx = (data.transactions ?? []) as Array<{
    id: string
    customer?: string
    amount?: number
    revenue?: number
    status?: string
    time?: string
    timestamp?: string
    items?: number
  }>

  const transactions: ExecutiveData['transactions'] = rawTx.map((t) => ({
    id: t.id.slice(0, 8).toUpperCase(),
    customer: t.customer ?? 'Customer',
    amount: t.amount ?? t.revenue ?? 0,
    status: (t.status as ExecutiveData['transactions'][0]['status']) ?? 'paid',
    time: t.time ? relTime(new Date(t.time)) : t.timestamp ? relTime(new Date(t.timestamp)) : 'recently',
    items: t.items ?? 1,
  }))

  return {
    kpis: {
      revenue: {
        value: todaySales.totalRevenue,
        change: revenueChange,
        label: "Today's Revenue",
        prefix: '$',
        sparkline: filledWeek.map((r) => r.revenue),
      },
      activeOrders: {
        value: activeOrderCount,
        change: ordersChange,
        label: 'Active Orders',
        sparkline: orderSparkline.length ? orderSparkline : filledWeek.map(() => 0),
      },
      lowStock: {
        value: inventory.summary?.lowStockCount ?? inventory.reorderRequired.length,
        change: 0,
        label: 'Low Stock Items',
        sparkline: inventory.reorderRequired.slice(0, 7).map((_, i) => i + 1),
      },
      activeWorkflows: {
        value: runningWorkflowCount,
        change: 0,
        label: 'Active Workflows',
        sparkline: [runningWorkflowCount],
      },
      aiCalls: {
        used: aiCallsToday,
        limit: 100,
        label: 'AI Calls Today',
        sparkline: [aiCallsToday],
      },
    },
    insight: data.insight ?? { summary: '', generatedAt: new Date().toISOString() },
    revenueChart: filledWeek.map((r) => ({
      date: r.date.slice(5, 10),
      revenue: r.revenue,
      isToday: r.date.slice(5, 10) === todayKey,
    })),
    agentActivity,
    alerts,
    recentWorkflows,
    predictions: predictions.slice(0, 5),
    transactions,
  }
}
