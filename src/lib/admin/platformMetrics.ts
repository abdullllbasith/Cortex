import type { TenantPlan } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { PLAN_PRICING } from '@/lib/settings/billingService'

export interface OverviewMetrics {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  churnedThisMonth: number
  MRR: number
  ARR: number
  avgRevenuePerTenant: number
  totalAICallsToday: number
  storageUsedGB: number
  activeWorkflowsRunning: number
}

export interface MRRTrendPoint {
  date: string
  mrr: number
  tenantCount: number
}

export interface PlanDistribution {
  plan: TenantPlan
  count: number
  mrr: number
}

export interface SignupTrendPoint {
  date: string
  signups: number
}

export interface ChurnMetrics {
  churnRate: number
  churnedThisPeriod: number
  totalAtPeriodStart: number
  reasons: Array<{ reason: string; count: number }>
}

export interface TechMetrics {
  avgApiResponseTimeMs: number
  errorRate: number
  queueDepths: {
    agentTasksPending: number
    agentTasksProcessing: number
    workflowExecutionsPending: number
    workflowExecutionsRunning: number
  }
  webhookSuccessRate: number
  sampledRequests: number
}

const TRIAL_DAYS = 14
const ACTIVE_WINDOW_DAYS = 30

function planMrr(plan: TenantPlan): number {
  return PLAN_PRICING[plan]?.price ?? 0
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseTenantStatus(settings: unknown): string | undefined {
  if (!settings || typeof settings !== 'object') return undefined
  const status = (settings as Record<string, unknown>).status
  return typeof status === 'string' ? status : undefined
}

function parseChurnReason(settings: unknown): string {
  if (!settings || typeof settings !== 'object') return 'unknown'
  const reason = (settings as Record<string, unknown>).churnReason
  return typeof reason === 'string' && reason.trim() ? reason : 'unknown'
}

async function getActiveTenantIds(since: Date): Promise<Set<string>> {
  const [loginUsers, agentActivity] = await Promise.all([
    prisma.user.findMany({
      where: { lastLoginAt: { gte: since } },
      select: { tenantId: true },
      distinct: ['tenantId'],
    }),
    prisma.agentLog.findMany({
      where: { createdAt: { gte: since } },
      select: { tenantId: true },
      distinct: ['tenantId'],
    }),
  ])

  return new Set([
    ...loginUsers.map((u) => u.tenantId),
    ...agentActivity.map((a) => a.tenantId),
  ])
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const trialCutoff = daysAgo(TRIAL_DAYS)
  const monthStart = startOfMonth()
  const activeSince = daysAgo(ACTIVE_WINDOW_DAYS)

  const [tenants, activeTenantIds, aiCallsToday, runningWorkflows, knowledgeCount] =
    await Promise.all([
      prisma.tenant.findMany({ select: { id: true, plan: true, settings: true, createdAt: true, updatedAt: true } }),
      getActiveTenantIds(activeSince),
      prisma.agentLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.workflowExecution.count({ where: { status: 'RUNNING' } }),
      prisma.businessKnowledge.count(),
    ])

  const totalTenants = tenants.length
  const trialTenants = tenants.filter(
    (t) => t.createdAt >= trialCutoff && t.plan === 'STARTER',
  ).length
  const activeTenants = tenants.filter((t) => activeTenantIds.has(t.id)).length
  const churnedThisMonth = tenants.filter((t) => {
    const status = parseTenantStatus(t.settings)
    return status === 'churned' && t.updatedAt >= monthStart
  }).length

  const payingTenants = tenants.filter(
    (t) => parseTenantStatus(t.settings) !== 'churned',
  )
  const MRR = payingTenants.reduce((sum, t) => sum + planMrr(t.plan), 0)
  const ARR = MRR * 12
  const avgRevenuePerTenant =
    payingTenants.length > 0 ? Math.round((MRR / payingTenants.length) * 100) / 100 : 0

  const storageUsedGB = Math.round(knowledgeCount * 0.002 * 100) / 100

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    churnedThisMonth,
    MRR,
    ARR,
    avgRevenuePerTenant,
    totalAICallsToday: aiCallsToday,
    storageUsedGB,
    activeWorkflowsRunning: runningWorkflows,
  }
}

export async function getMRRTrend(days: 30 | 90 | 365): Promise<MRRTrendPoint[]> {
  const tenants = await prisma.tenant.findMany({
    select: { plan: true, createdAt: true, settings: true },
    orderBy: { createdAt: 'asc' },
  })

  const points: MRRTrendPoint[] = []
  const end = startOfDay(new Date())

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end)
    date.setDate(date.getDate() - i)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const activeOnDay = tenants.filter((t) => {
      if (t.createdAt > dayEnd) return false
      if (parseTenantStatus(t.settings) === 'churned') {
        return false
      }
      return true
    })

    const mrr = activeOnDay.reduce((sum, t) => sum + planMrr(t.plan), 0)
    points.push({
      date: date.toISOString().slice(0, 10),
      mrr,
      tenantCount: activeOnDay.length,
    })
  }

  return points
}

export async function getPlanDistribution(): Promise<PlanDistribution[]> {
  const tenants = await prisma.tenant.findMany({
    select: { plan: true, settings: true },
  })

  const paying = tenants.filter((t) => parseTenantStatus(t.settings) !== 'churned')
  const counts = new Map<TenantPlan, number>()
  for (const t of paying) {
    counts.set(t.plan, (counts.get(t.plan) ?? 0) + 1)
  }

  return (['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as TenantPlan[]).map((plan) => ({
    plan,
    count: counts.get(plan) ?? 0,
    mrr: (counts.get(plan) ?? 0) * planMrr(plan),
  }))
}

export async function getSignupTrend(days: number): Promise<SignupTrendPoint[]> {
  const since = daysAgo(days - 1)
  const tenants = await prisma.tenant.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  })

  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(new Date())
    d.setDate(d.getDate() - i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }

  for (const t of tenants) {
    const key = startOfDay(t.createdAt).toISOString().slice(0, 10)
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }

  return [...buckets.entries()].map(([date, signups]) => ({ date, signups }))
}

export async function getChurnMetrics(periodDays = 30): Promise<ChurnMetrics> {
  const periodStart = daysAgo(periodDays)
  const tenants = await prisma.tenant.findMany({
    select: { settings: true, updatedAt: true, createdAt: true },
  })

  const atPeriodStart = tenants.filter((t) => t.createdAt < periodStart).length
  const churned = tenants.filter((t) => {
    const status = parseTenantStatus(t.settings)
    return status === 'churned' && t.updatedAt >= periodStart
  })

  const reasonCounts = new Map<string, number>()
  for (const t of churned) {
    const reason = parseChurnReason(t.settings)
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  const churnRate =
    atPeriodStart > 0
      ? Math.round((churned.length / atPeriodStart) * 10000) / 100
      : 0

  return {
    churnRate,
    churnedThisPeriod: churned.length,
    totalAtPeriodStart: atPeriodStart,
    reasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export async function getTechMetrics(): Promise<TechMetrics> {
  const since = daysAgo(1)

  const [
    webhookDeliveries,
    failedAgentLogs,
    totalAgentLogs,
    agentPending,
    agentProcessing,
    wfPending,
    wfRunning,
  ] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: { createdAt: { gte: since }, responseTimeMs: { not: null } },
      select: { responseTimeMs: true, success: true },
      take: 5000,
    }),
    prisma.agentLog.count({
      where: { createdAt: { gte: since }, status: 'FAILURE' },
    }),
    prisma.agentLog.count({ where: { createdAt: { gte: since } } }),
    prisma.agentTask.count({ where: { status: 'PENDING' } }),
    prisma.agentTask.count({ where: { status: 'PROCESSING' } }),
    prisma.workflowExecution.count({ where: { status: 'PENDING' } }),
    prisma.workflowExecution.count({ where: { status: 'RUNNING' } }),
  ])

  const avgApiResponseTimeMs =
    webhookDeliveries.length > 0
      ? Math.round(
          webhookDeliveries.reduce((s, d) => s + (d.responseTimeMs ?? 0), 0) /
            webhookDeliveries.length,
        )
      : 0

  const webhookSuccessRate =
    webhookDeliveries.length > 0
      ? Math.round(
          (webhookDeliveries.filter((d) => d.success).length / webhookDeliveries.length) * 10000,
        ) / 100
      : 100

  const errorRate =
    totalAgentLogs > 0
      ? Math.round((failedAgentLogs / totalAgentLogs) * 10000) / 100
      : 0

  return {
    avgApiResponseTimeMs,
    errorRate,
    queueDepths: {
      agentTasksPending: agentPending,
      agentTasksProcessing: agentProcessing,
      workflowExecutionsPending: wfPending,
      workflowExecutionsRunning: wfRunning,
    },
    webhookSuccessRate,
    sampledRequests: webhookDeliveries.length,
  }
}
