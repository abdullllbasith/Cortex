import { ContactSource, DealStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { calculatePipelineValue, getDefaultPipeline, parseStages } from './pipelineService'

function toNumber(v: Decimal | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : v.toNumber()
}

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

const FUNNEL_STAGE_IDS = ['lead', 'contacted', 'demo', 'proposal', 'won'] as const

export async function getCrmDashboard(tenantId: string, userId?: string) {
  const now = new Date()
  const monthStartDate = monthStart(now)
  const nextMonth = addMonths(monthStartDate, 1)
  const monthAfter = addMonths(monthStartDate, 2)
  const monthAfter2 = addMonths(monthStartDate, 3)

  const [
    totalContacts,
    openDeals,
    pipelineSummary,
    wonThisMonth,
    closedDeals,
    overdueContactsRaw,
    recentActivities,
    openDealsByStage,
    wonDealsAllTime,
    defaultPipeline,
    myOpenDealsRaw,
  ] = await Promise.all([
    prisma.crmContact.count({ where: { tenantId, isActive: true } }),
    prisma.crmDeal.count({ where: { tenantId, status: DealStatus.OPEN } }),
    calculatePipelineValue(tenantId),
    prisma.crmDeal.findMany({
      where: { tenantId, status: DealStatus.WON, wonAt: { gte: monthStartDate } },
      select: { value: true },
    }),
    prisma.crmDeal.findMany({
      where: { tenantId, status: { in: [DealStatus.WON, DealStatus.LOST] } },
      select: { status: true, value: true },
    }),
    prisma.crmContact.findMany({
      where: { tenantId, isActive: true, nextFollowUpAt: { lt: now } },
      take: 25,
      orderBy: { nextFollowUpAt: 'asc' },
      include: {
        owner: { select: { fullName: true } },
        deals: { where: { status: DealStatus.OPEN }, select: { value: true } },
      },
    }),
    prisma.crmActivity.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        creator: { select: { fullName: true } },
      },
    }),
    prisma.crmDeal.groupBy({
      by: ['stageId'],
      where: { tenantId, status: DealStatus.OPEN },
      _count: true,
      _sum: { value: true },
    }),
    prisma.crmDeal.count({ where: { tenantId, status: DealStatus.WON } }),
    getDefaultPipeline(tenantId),
    userId
      ? prisma.crmDeal.findMany({
          where: { tenantId, ownerId: userId, status: DealStatus.OPEN },
          orderBy: [{ expectedCloseDate: 'asc' }, { updatedAt: 'desc' }],
          take: 10,
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
            pipeline: { select: { stages: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const wonCount = closedDeals.filter((d) => d.status === DealStatus.WON).length
  const lostCount = closedDeals.filter((d) => d.status === DealStatus.LOST).length
  const wonValue = wonThisMonth.reduce((s, d) => s + toNumber(d.value), 0)
  const avgDealSize =
    closedDeals.length > 0
      ? closedDeals.reduce((s, d) => s + toNumber(d.value), 0) / closedDeals.length
      : 0
  const conversionRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0

  const stageCounts = new Map(openDealsByStage.map((r) => [r.stageId, r._count]))
  const stages = defaultPipeline ? parseStages(defaultPipeline.stages) : []
  const funnel = FUNNEL_STAGE_IDS.map((stageId) => {
    const meta = stages.find((s) => s.id === stageId)
    const count =
      stageId === 'won'
        ? wonDealsAllTime
        : (stageCounts.get(stageId) ?? 0)
    return {
      stage: meta?.name ?? stageId.charAt(0).toUpperCase() + stageId.slice(1),
      stageId,
      count,
    }
  })

  const funnelWithConversion = funnel.map((row, i) => {
    const prev = i > 0 ? funnel[i - 1].count : null
    const conversionPct =
      prev != null && prev > 0 ? Math.round((row.count / prev) * 1000) / 10 : null
    return { ...row, conversionPct }
  })

  const overdueFollowUps = overdueContactsRaw
    .map((c) => {
      const dealValue = c.deals.reduce((s, d) => s + toNumber(d.value), 0)
      return {
        id: c.id,
        fullName: `${c.firstName} ${c.lastName}`.trim(),
        company: c.company,
        phone: c.mobile ?? c.phone,
        nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
        ownerName: c.owner?.fullName ?? null,
        dealValue,
      }
    })
    .sort((a, b) => b.dealValue - a.dealValue)
    .slice(0, 10)

  const forecastDeals = await prisma.crmDeal.findMany({
    where: {
      tenantId,
      status: DealStatus.OPEN,
      expectedCloseDate: { gte: monthStartDate, lt: monthAfter2 },
    },
    select: { expectedCloseDate: true, value: true, probability: true },
  })

  const forecastMonths = [
    { month: formatMonth(monthStartDate), expectedRevenue: 0 },
    { month: formatMonth(nextMonth), expectedRevenue: 0 },
    { month: formatMonth(monthAfter), expectedRevenue: 0 },
  ]

  for (const deal of forecastDeals) {
    if (!deal.expectedCloseDate) continue
    const idx = monthIndex(deal.expectedCloseDate, monthStartDate)
    if (idx >= 0 && idx < 3) {
      forecastMonths[idx].expectedRevenue += toNumber(deal.value) * (deal.probability / 100)
    }
  }

  return {
    kpis: {
      totalContacts,
      openDeals,
      pipelineValue: pipelineSummary.totalValue,
      weightedPipeline: pipelineSummary.weightedValue,
      wonThisMonth: wonValue,
      avgDealSize,
      conversionRate,
    },
    funnel: funnelWithConversion,
    revenueForecast: forecastMonths,
    overdueFollowUps,
    myOpenDeals: myOpenDealsRaw.map((d) => {
      const pStages = parseStages(d.pipeline.stages)
      const stageName = pStages.find((s) => s.id === d.stageId)?.name ?? d.stageId
      return {
        id: d.id,
        title: d.title,
        stageId: d.stageId,
        stageName,
        value: toNumber(d.value),
        currency: d.currency,
        probability: d.probability,
        expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
        contactId: d.contactId,
        contactName: d.contact
          ? `${d.contact.firstName} ${d.contact.lastName}`.trim()
          : null,
      }
    }),
    activityFeed: recentActivities.map((a) => ({
      id: a.id,
      type: a.type,
      subject: a.subject,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
      contactId: a.contactId,
      contactName: a.contact
        ? `${a.contact.firstName} ${a.contact.lastName}`.trim()
        : null,
      createdBy: a.creator?.fullName ?? null,
    })),
  }
}

export async function getCrmAnalytics(tenantId: string) {
  const [wonDeals, lostDeals, openDeals, contactsBySource, repDeals] = await Promise.all([
    prisma.crmDeal.findMany({
      where: { tenantId, status: DealStatus.WON },
      select: { stageId: true, value: true, createdAt: true, wonAt: true, ownerId: true },
    }),
    prisma.crmDeal.findMany({
      where: { tenantId, status: DealStatus.LOST },
      select: { lostReason: true, stageId: true },
    }),
    prisma.crmDeal.findMany({
      where: { tenantId, status: DealStatus.OPEN },
      select: { stageId: true, stageEnteredAt: true },
    }),
    prisma.crmContact.groupBy({
      by: ['source'],
      where: { tenantId, isActive: true },
      _count: true,
    }),
    prisma.crmDeal.findMany({
      where: { tenantId, ownerId: { not: null } },
      select: {
        ownerId: true,
        status: true,
        value: true,
        owner: { select: { fullName: true, avatarUrl: true } },
      },
    }),
  ])

  const stageWinCounts = new Map<string, { won: number; total: number }>()
  for (const d of wonDeals) {
    const e = stageWinCounts.get(d.stageId) ?? { won: 0, total: 0 }
    e.won += 1
    e.total += 1
    stageWinCounts.set(d.stageId, e)
  }
  for (const d of lostDeals) {
    const e = stageWinCounts.get(d.stageId) ?? { won: 0, total: 0 }
    e.total += 1
    stageWinCounts.set(d.stageId, e)
  }

  const winRateByStage = [...stageWinCounts.entries()].map(([stageId, stats]) => ({
    stageId,
    winRate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
    totalClosed: stats.total,
  }))

  const avgDaysByStage = new Map<string, number[]>()
  for (const d of openDeals) {
    const days = Math.floor((Date.now() - d.stageEnteredAt.getTime()) / 86400000)
    const list = avgDaysByStage.get(d.stageId) ?? []
    list.push(days)
    avgDaysByStage.set(d.stageId, list)
  }
  for (const d of wonDeals) {
    if (!d.wonAt) continue
    const days = Math.floor((d.wonAt.getTime() - d.createdAt.getTime()) / 86400000)
    const list = avgDaysByStage.get(d.stageId) ?? []
    list.push(days)
    avgDaysByStage.set(d.stageId, list)
  }

  const avgTimePerStage = [...avgDaysByStage.entries()].map(([stageId, days]) => ({
    stageId,
    avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
  }))

  const lossReasons = new Map<string, number>()
  for (const d of lostDeals) {
    const reason = d.lostReason?.trim() || 'Unspecified'
    lossReasons.set(reason, (lossReasons.get(reason) ?? 0) + 1)
  }

  const lossReasonBreakdown = [...lossReasons.entries()].map(([reason, count]) => ({
    reason,
    count,
  }))

  const sourceContactIds = await prisma.crmContact.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, source: true },
  })
  const contactSourceMap = new Map(sourceContactIds.map((c) => [c.id, c.source]))

  const dealsWithContact = await prisma.crmDeal.findMany({
    where: { tenantId, contactId: { not: null }, status: { in: [DealStatus.WON, DealStatus.LOST, DealStatus.OPEN] } },
    select: { contactId: true, status: true },
  })

  const sourceStats = new Map<ContactSource, { leads: number; converted: number }>()
  for (const row of contactsBySource) {
    sourceStats.set(row.source, { leads: row._count, converted: 0 })
  }
  for (const deal of dealsWithContact) {
    if (!deal.contactId || deal.status !== DealStatus.WON) continue
    const source = contactSourceMap.get(deal.contactId)
    if (!source) continue
    const stats = sourceStats.get(source) ?? { leads: 0, converted: 0 }
    stats.converted += 1
    sourceStats.set(source, stats)
  }

  const leadSourcePerformance = [...sourceStats.entries()].map(([source, stats]) => ({
    source,
    leads: stats.leads,
    converted: stats.converted,
    conversionRate: stats.leads > 0 ? (stats.converted / stats.leads) * 100 : 0,
  }))

  const repMap = new Map<
    string,
    { name: string; avatarUrl: string | null; open: number; won: number; lost: number; revenue: number }
  >()
  for (const d of repDeals) {
    if (!d.ownerId) continue
    const rep = repMap.get(d.ownerId) ?? {
      name: d.owner?.fullName ?? 'Unknown',
      avatarUrl: d.owner?.avatarUrl ?? null,
      open: 0,
      won: 0,
      lost: 0,
      revenue: 0,
    }
    if (d.status === DealStatus.OPEN) rep.open += 1
    if (d.status === DealStatus.WON) {
      rep.won += 1
      rep.revenue += toNumber(d.value)
    }
    if (d.status === DealStatus.LOST) rep.lost += 1
    repMap.set(d.ownerId, rep)
  }

  const repPerformance = [...repMap.entries()].map(([ownerId, stats]) => ({
    ownerId,
    ...stats,
    winRate: stats.won + stats.lost > 0 ? (stats.won / (stats.won + stats.lost)) * 100 : 0,
  }))

  return {
    winRateByStage,
    avgTimePerStage,
    lossReasonBreakdown,
    leadSourcePerformance,
    repPerformance,
  }
}

export async function listContactDeals(tenantId: string, contactId: string) {
  const deals = await prisma.crmDeal.findMany({
    where: { tenantId, contactId },
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: { select: { fullName: true, avatarUrl: true } },
      pipeline: { select: { id: true, name: true, stages: true } },
    },
  })

  const open = deals.filter((d) => d.status === DealStatus.OPEN).map(formatDeal)
  const history = deals.filter((d) => d.status !== DealStatus.OPEN).map(formatDeal)
  return { open, history }
}

function formatDeal(d: {
  id: string
  title: string
  stageId: string
  status: DealStatus
  value: Decimal
  currency: string
  probability: number
  expectedCloseDate: Date | null
  wonAt: Date | null
  lostAt: Date | null
  lostReason: string | null
  stageEnteredAt: Date
  pipeline: { id: string; name: string; stages: unknown }
  owner: { fullName: string; avatarUrl: string | null } | null
}) {
  const stages = Array.isArray(d.pipeline.stages)
    ? (d.pipeline.stages as Array<{ id: string; name: string; order?: number }>)
    : []
  const stageName = stages.find((s) => s.id === d.stageId)?.name ?? d.stageId
  const openStages = stages
    .filter((s) => s.id !== 'won' && s.id !== 'lost')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return {
    id: d.id,
    title: d.title,
    stageId: d.stageId,
    stageName,
    pipelineId: d.pipeline.id,
    stages: openStages.map((s) => ({ id: s.id, name: s.name })),
    status: d.status,
    value: toNumber(d.value),
    currency: d.currency,
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    wonAt: d.wonAt?.toISOString() ?? null,
    lostAt: d.lostAt?.toISOString() ?? null,
    lostReason: d.lostReason,
    daysInStage: Math.floor((Date.now() - d.stageEnteredAt.getTime()) / 86400000),
    pipelineName: d.pipeline.name,
    owner: d.owner,
  }
}

function formatMonth(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function monthIndex(date: Date, base: Date) {
  return (date.getFullYear() - base.getFullYear()) * 12 + (date.getMonth() - base.getMonth())
}
