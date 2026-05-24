import { prisma } from '@/lib/db/prisma'
import type { ExecutiveAnalyticsData } from '@/lib/analytics/types'
import type { ExecutiveData } from '@/components/dashboard/types'
import { formatDistanceToNow } from 'date-fns'

function relTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })
}

export async function mapToDashboardData(
  data: ExecutiveAnalyticsData & { transactions?: Array<Record<string, unknown>> },
  tenantId: string,
): Promise<ExecutiveData> {
  const sales = data.modules.sales
  const inventory = data.modules.inventory
  const todayKey = new Date().toISOString().slice(5, 10)

  const [agentLogs, activeTasks, aiCallsToday] = await Promise.all([
    prisma.agentLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.agentTask.count({
      where: { tenantId, status: { in: ['PENDING', 'PROCESSING'] } },
    }),
    prisma.conversationMessage.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ])

  const revenueChange = data.scorecard.find((s) => s.metric === 'Revenue')?.change ?? 0
  const ordersChange = data.scorecard.find((s) => s.metric === 'Orders')?.change ?? 0

  const alerts: ExecutiveData['alerts'] = inventory.reorderRequired.slice(0, 3).map((p, i) => ({
    id: `stock-${p.productId}`,
    title: `Low stock: ${p.name}`,
    severity: 'warning' as const,
    time: relTime(new Date()),
  }))

  if (data.modules.customers.churnRate > 5) {
    alerts.unshift({
      id: 'churn-alert',
      title: `Churn rate elevated at ${data.modules.customers.churnRate}%`,
      severity: 'danger',
      time: relTime(new Date()),
    })
  }

  const agentActivity: ExecutiveData['agentActivity'] = agentLogs.length
    ? agentLogs.map((log) => ({
        id: log.id,
        agent: log.agentType.charAt(0) + log.agentType.slice(1).toLowerCase(),
        action: log.action,
        time: relTime(log.createdAt),
        type: log.status === 'FAILURE' ? 'alert' : log.action.toLowerCase().includes('inventory') ? 'inventory' : 'analytics',
      }))
    : [
        { id: '1', agent: 'Sales', action: 'Analyzed revenue trends for the period', time: 'just now', type: 'analytics' },
        { id: '2', agent: 'Inventory', action: `${inventory.reorderRequired.length} products flagged for reorder`, time: '2m ago', type: 'inventory' },
      ]

  const recentWorkflows: ExecutiveData['recentWorkflows'] = [
    { id: 'wf-1', name: 'Daily sales snapshot', status: 'success', duration: '1.2s', time: relTime(new Date()) },
    { id: 'wf-2', name: 'Inventory health check', status: activeTasks > 0 ? 'running' : 'success', duration: '—', time: relTime(new Date()) },
  ]

  const predictions: ExecutiveData['predictions'] = inventory.reorderRequired.slice(0, 2).map((p, i) => ({
    id: `pred-${p.productId}`,
    event: `${p.name} stockout risk`,
    confidence: 72 + i * 8,
    daysOut: 7 + i * 5,
    severity: 'warning' as const,
  }))

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
        value: sales.totalRevenue,
        change: revenueChange,
        label: "Today's Revenue",
        prefix: '$',
        sparkline: data.revenueChart.map((r) => r.revenue),
      },
      activeOrders: {
        value: sales.totalOrders,
        change: ordersChange,
        label: 'Active Orders',
        sparkline: data.revenueChart.map((r) => r.revenue / 100),
      },
      lowStock: {
        value: inventory.reorderRequired.length,
        change: 0,
        label: 'Low Stock Items',
        sparkline: inventory.reorderRequired.map((_, i) => i + 1),
      },
      activeWorkflows: {
        value: activeTasks,
        change: 0,
        label: 'Active Workflows',
        sparkline: [activeTasks, activeTasks, activeTasks],
      },
      aiCalls: {
        used: aiCallsToday,
        limit: 100,
        label: 'AI Calls Today',
        sparkline: [aiCallsToday, aiCallsToday],
      },
    },
    insight: data.insight ?? { summary: '', generatedAt: new Date().toISOString() },
    revenueChart: data.revenueChart.map((r) => ({
      date: r.date,
      revenue: r.revenue,
      isToday: r.date === todayKey,
    })),
    agentActivity,
    alerts,
    recentWorkflows,
    predictions,
    transactions,
  }
}
