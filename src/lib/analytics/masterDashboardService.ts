import { DealStatus, InvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { PLAN_LIMITS } from '@/lib/settings/billingService'
import { calculatePipelineValue, getDefaultPipeline, parseStages } from '@/lib/crm/pipelineService'
import { InventoryAgent } from '@/lib/agents/InventoryAgent'
import { computeSalesMetrics, computeSalesTimeseries, getRecentTransactions } from './aggregationPipeline'
import { resolveDateRange, fillDailyTimeseriesGaps } from './periodUtils'

function toNumber(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : v.toNumber()
}

export interface PriorityActionLink {
  label: string
  href: string
}

export async function getMasterDashboardData(tenantId: string, userId?: string) {
  const todayRange = resolveDateRange('today')
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  fourteenDaysAgo.setHours(0, 0, 0, 0)
  const fourteenRange = {
    start: fourteenDaysAgo,
    end: new Date(),
    label: '14d',
    previousStart: fourteenDaysAgo,
    previousEnd: new Date(),
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const inventoryAgent = new InventoryAgent(tenantId)

  const [
    todaySales,
    activeOrders,
    pipeline,
    lowStock,
    arOutstanding,
    tenant,
    aiCallsToday,
    revenue14d,
    pipelineStages,
    overdueInvoices,
    overdueFollowUps,
    recentTransactions,
  ] = await Promise.all([
    computeSalesMetrics(tenantId, todayRange),
    prisma.salesOrder.count({
      where: { tenantId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    }),
    calculatePipelineValue(tenantId),
    inventoryAgent.getLowStockItems(),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        amountDue: { gt: 0 },
      },
      _sum: { amountDue: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
    prisma.agentLog.count({ where: { tenantId, createdAt: { gte: dayStart } } }),
    computeSalesTimeseries(tenantId, fourteenRange, 'day'),
    getPipelineByStage(tenantId),
    prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        dueDate: { lt: new Date() },
        amountDue: { gt: 0 },
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, company: true, email: true } } },
      orderBy: { dueDate: 'asc' },
      take: 5,
    }),
    getOverdueFollowUpItems(tenantId, userId),
    getRecentTransactions(tenantId, 10),
  ])

  const aiLimit = tenant ? PLAN_LIMITS[tenant.plan].aiCalls : 500
  const filledRevenue = fillDailyTimeseriesGaps(fourteenRange, revenue14d, (date) => ({
    date,
    revenue: 0,
    orderCount: 0,
    orders: 0,
    avgOrderValue: 0,
    margin: 0,
    marginPct: 0,
    previousRevenue: null,
  }))

  return {
    kpis: {
      revenueToday: Math.round(todaySales.totalRevenue * 100) / 100,
      activeOrders,
      pipelineValue: Math.round(pipeline.weightedValue * 100) / 100,
      lowStockItems: lowStock.count,
      arOutstanding: Math.round(toNumber(arOutstanding._sum.amountDue) * 100) / 100,
      aiCallsToday,
      aiCallsLimit: aiLimit,
    },
    revenueChart14d: filledRevenue.map((r) => ({
      date: r.date.slice(5, 10),
      revenue: r.revenue,
      fullDate: r.date,
    })),
    pipelineByStage: pipelineStages,
    overdueInvoices: overdueInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountDue: toNumber(inv.amountDue),
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      customerName: inv.contact
        ? `${inv.contact.firstName} ${inv.contact.lastName}`.trim() || inv.contact.company || 'Customer'
        : 'Customer',
      contactEmail: inv.contact?.email ?? null,
      canSendReminder: inv.status !== 'VOID' && inv.status !== 'CANCELLED' && !!inv.contact?.email,
    })),
    reorderAlerts: lowStock.items.slice(0, 5).map((item) => ({
      productId: item.productId,
      name: item.productName,
      sku: item.sku,
      onHand: item.quantityOnHand,
      reorderPoint: item.reorderPoint,
      urgency: item.urgency,
    })),
    overdueFollowUps,
    recentTransactions,
  }
}

async function getPipelineByStage(tenantId: string) {
  const pipeline = await getDefaultPipeline(tenantId)
  const stages = pipeline ? parseStages(pipeline.stages) : []
  const grouped = await prisma.crmDeal.groupBy({
    by: ['stageId'],
    where: { tenantId, status: DealStatus.OPEN },
    _count: true,
    _sum: { value: true },
  })
  const countMap = new Map(grouped.map((g) => [g.stageId, g._count]))
  const valueMap = new Map(grouped.map((g) => [g.stageId, toNumber(g._sum.value)]))

  const stageList = stages.length
    ? stages.filter((s) => s.id !== 'won' && s.id !== 'lost')
    : [...countMap.keys()].map((id) => ({ id, name: id, order: 0 }))

  return stageList
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      stageId: s.id,
      name: s.name,
      count: countMap.get(s.id) ?? 0,
      value: Math.round((valueMap.get(s.id) ?? 0) * 100) / 100,
    }))
    .filter((s) => s.count > 0 || s.value > 0)
}

async function getOverdueFollowUpItems(tenantId: string, userId?: string) {
  const now = new Date()
  const contacts = await prisma.crmContact.findMany({
    where: {
      tenantId,
      isActive: true,
      nextFollowUpAt: { lt: now },
      ...(userId ? { ownerId: userId } : {}),
    },
    orderBy: { nextFollowUpAt: 'asc' },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      nextFollowUpAt: true,
      phone: true,
      mobile: true,
    },
  })

  return contacts.map((c) => ({
    contactId: c.id,
    name: `${c.firstName} ${c.lastName}`.trim() || c.company || 'Contact',
    company: c.company,
    phone: c.mobile ?? c.phone,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
    href: `/crm/contacts/${c.id}`,
  }))
}

export function mapBriefingActions(actions: string[]): PriorityActionLink[] {
  const links: PriorityActionLink[] = []
  for (const action of actions.slice(0, 3)) {
    const lower = action.toLowerCase()
    let href = '/dashboard'
    if (/low.?stock|reorder|replenish|sku/i.test(lower)) href = '/inventory/reorder'
    else if (/invoice|ar|collect|receivable/i.test(lower)) href = '/finance/invoices'
    else if (/pipeline|deal/i.test(lower)) href = '/crm/pipeline'
    else if (/expense|margin|profit|finance/i.test(lower)) href = '/finance'
    else if (/leave|hr|headcount/i.test(lower)) href = '/hr'
    else if (/follow.?up|crm|contact/i.test(lower)) href = '/crm'
    links.push({ label: action, href })
  }
  return links
}
