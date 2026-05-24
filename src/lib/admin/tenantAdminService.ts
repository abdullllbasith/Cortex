import type { TenantPlan } from '@prisma/client'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { PLAN_LIMITS, PLAN_PRICING } from '@/lib/settings/billingService'
import { parseTenantSettings } from '@/lib/settings/types'
import {
  mergeAdminSettings,
  parseAdminSettings,
  resolveTenantStatus,
  type TenantAdminStatus,
  type TenantQuotaOverrides,
} from '@/lib/admin/tenantSettingsAdmin'

export interface TenantListItem {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: TenantAdminStatus
  userCount: number
  MRR: number
  AICallsThisMonth: number
  storageUsedMB: number
  lastActiveAt: string | null
  createdAt: string
  ownerEmail: string | null
}

export interface TenantListResult {
  items: TenantListItem[]
  total: number
  page: number
  limit: number
}

export interface TenantDetail extends TenantListItem {
  settings: Record<string, unknown>
  admin: ReturnType<typeof parseAdminSettings>
  quotas: (typeof PLAN_LIMITS)[TenantPlan]
  usageHistory: {
    aiCallsByMonth: Array<{ month: string; count: number }>
    workflowsTotal: number
    apiKeysActive: number
    teamMembers: number
  }
  users: Array<{
    id: string
    email: string
    fullName: string
    role: string
    lastLoginAt: string | null
    isActive: boolean
  }>
  supportTickets: Array<{
    id: string
    subject: string
    status: string
    priority: string
    createdAt: string
  }>
}

function startOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

async function readTenantSettingsRaw(tenantId: string): Promise<unknown> {
  const rows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  return rows[0]?.settings ?? {}
}

async function writeTenantSettingsRaw(tenantId: string, settings: Record<string, unknown>) {
  const payload = JSON.stringify(settings)
  await prisma.$executeRaw`
    UPDATE "tenants"
    SET "settings" = ${payload}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${tenantId}
  `
}

async function buildTenantStats(tenant: {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  settings: unknown
  createdAt: Date
}) {
  const monthStart = startOfMonth()
  const admin = parseAdminSettings(tenant.settings)
  const status = resolveTenantStatus(admin, tenant.createdAt, tenant.plan)

  const [userCount, aiCalls, knowledgeCount, lastUserLogin, owner] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id, isActive: true } }),
    prisma.agentLog.count({
      where: { tenantId: tenant.id, createdAt: { gte: monthStart } },
    }),
    prisma.businessKnowledge.count({ where: { tenantId: tenant.id } }),
    prisma.user.findFirst({
      where: { tenantId: tenant.id, lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: 'desc' },
      select: { lastLoginAt: true },
    }),
    prisma.user.findFirst({
      where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
      select: { email: true },
    }),
  ])

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    status,
    userCount,
    MRR: PLAN_PRICING[tenant.plan]?.price ?? 0,
    AICallsThisMonth: aiCalls,
    storageUsedMB: Math.round(knowledgeCount * 2),
    lastActiveAt: lastUserLogin?.lastLoginAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
    ownerEmail: owner?.email ?? null,
  }
}

export async function listTenants(params: {
  search?: string
  plan?: TenantPlan
  status?: TenantAdminStatus
  sort?: 'mrr' | 'createdAt' | 'activity'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}): Promise<TenantListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const q = params.search?.trim()

  const where = {
    ...(params.plan ? { plan: params.plan } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
            { users: { some: { email: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: params.sort === 'createdAt' ? (params.order ?? 'desc') : 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      settings: true,
      createdAt: true,
    },
  })

  let items = await Promise.all(tenants.map((t) => buildTenantStats(t)))

  if (params.status) {
    items = items.filter((t) => t.status === params.status)
  }

  const sortKey = params.sort ?? 'createdAt'
  const order = params.order ?? 'desc'
  items.sort((a, b) => {
    let cmp = 0
    if (sortKey === 'mrr') cmp = a.MRR - b.MRR
    else if (sortKey === 'activity') {
      const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
      const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
      cmp = aTime - bTime
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    return order === 'asc' ? cmp : -cmp
  })

  const total = items.length
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  return { items: paged, total, page, limit }
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      settings: true,
      createdAt: true,
    },
  })
  if (!tenant) return null

  const base = await buildTenantStats(tenant)
  const admin = parseAdminSettings(tenant.settings)
  const quotas = { ...PLAN_LIMITS[tenant.plan], ...admin.quotaOverrides }

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [users, tickets, aiLogs, workflowCount, apiKeyCount] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.supportTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, subject: true, status: true, priority: true, createdAt: true },
    }),
    prisma.agentLog.findMany({
      where: { tenantId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.workflowDefinition.count({ where: { tenantId } }),
    prisma.apiKey.count({ where: { tenantId, isActive: true } }),
  ])

  const monthBuckets = new Map<string, number>()
  for (const log of aiLogs) {
    const key = log.createdAt.toISOString().slice(0, 7)
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1)
  }

  return {
    ...base,
    settings: parseTenantSettings(tenant.settings) as Record<string, unknown>,
    admin,
    quotas,
    usageHistory: {
      aiCallsByMonth: [...monthBuckets.entries()]
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      workflowsTotal: workflowCount,
      apiKeysActive: apiKeyCount,
      teamMembers: users.filter((u) => u.isActive).length,
    },
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      isActive: u.isActive,
    })),
    supportTickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}

export async function setTenantSuspended(
  tenantId: string,
  suspended: boolean,
  reason: string,
  adminEmail: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  const settings = await readTenantSettingsRaw(tenantId)
  const merged = mergeAdminSettings(settings, {
    status: suspended ? 'suspended' : 'active',
    suspendReason: suspended ? reason : undefined,
    suspendedAt: suspended ? new Date().toISOString() : undefined,
    adminNotes: [
      ...(parseAdminSettings(settings).adminNotes ?? []),
      {
        at: new Date().toISOString(),
        by: adminEmail,
        note: suspended ? `Suspended: ${reason}` : `Unsuspended: ${reason || 'No reason provided'}`,
      },
    ],
  })

  await writeTenantSettingsRaw(tenantId, merged as Record<string, unknown>)
  return { tenantId, suspended, status: suspended ? 'suspended' : 'active' }
}

export async function overrideTenantPlan(
  tenantId: string,
  plan: TenantPlan,
  note: string,
  adminEmail: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  await prisma.tenant.update({ where: { id: tenantId }, data: { plan } })

  const settings = await readTenantSettingsRaw(tenantId)
  const merged = mergeAdminSettings(settings, {
    planOverrideNote: note,
    adminNotes: [
      ...(parseAdminSettings(settings).adminNotes ?? []),
      {
        at: new Date().toISOString(),
        by: adminEmail,
        note: `Plan changed to ${plan}: ${note}`,
      },
    ],
  })
  await writeTenantSettingsRaw(tenantId, merged as Record<string, unknown>)

  return { tenantId, plan, note }
}

export async function overrideTenantQuotas(
  tenantId: string,
  quotas: TenantQuotaOverrides,
  adminEmail: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  const settings = await readTenantSettingsRaw(tenantId)
  const admin = parseAdminSettings(settings)
  const merged = mergeAdminSettings(settings, {
    quotaOverrides: { ...admin.quotaOverrides, ...quotas },
    adminNotes: [
      ...(admin.adminNotes ?? []),
      {
        at: new Date().toISOString(),
        by: adminEmail,
        note: `Quota override updated: ${JSON.stringify(quotas)}`,
      },
    ],
  })
  await writeTenantSettingsRaw(tenantId, merged as Record<string, unknown>)

  return { tenantId, quotas: { ...PLAN_LIMITS[tenant.plan], ...admin.quotaOverrides, ...quotas } }
}

export async function hardDeleteTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } })
  if (!tenant) throw new Error('Tenant not found')

  await prisma.tenant.delete({ where: { id: tenantId } })
  return { deleted: true, tenantId, name: tenant.name }
}

export async function triggerTenantExport(tenantId: string, adminId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  const exportId = randomBytes(12).toString('hex')
  const settings = await readTenantSettingsRaw(tenantId)
  const admin = parseAdminSettings(settings)

  const [users, knowledge, workflows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    }),
    prisma.businessKnowledge.count({ where: { tenantId } }),
    prisma.workflowDefinition.count({ where: { tenantId } }),
  ])

  const exportPayload = {
    exportId,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    exportedAt: new Date().toISOString(),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
    counts: { knowledge, workflows },
  }

  const merged = mergeAdminSettings(settings, {
    exportRequests: [
      ...(admin.exportRequests ?? []),
      {
        id: exportId,
        requestedAt: new Date().toISOString(),
        requestedBy: adminId,
        status: 'completed' as const,
        downloadUrl: `/api/admin/tenants/${tenantId}/export?id=${exportId}`,
      },
    ],
  })
  await writeTenantSettingsRaw(tenantId, merged as Record<string, unknown>)

  return { exportId, status: 'completed' as const, data: exportPayload }
}

export async function getTenantExportData(tenantId: string, exportId: string) {
  const settings = await readTenantSettingsRaw(tenantId)
  const admin = parseAdminSettings(settings)
  const req = admin.exportRequests?.find((e) => e.id === exportId)
  if (!req) throw new Error('Export not found')

  const [users, knowledge, workflows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    }),
    prisma.businessKnowledge.findMany({
      where: { tenantId },
      select: { id: true, title: true, type: true, createdAt: true },
      take: 500,
    }),
    prisma.workflowDefinition.findMany({
      where: { tenantId },
      select: { id: true, name: true, isActive: true, createdAt: true },
    }),
  ])

  return {
    exportId,
    tenantId,
    exportedAt: req.requestedAt,
    users,
    knowledge,
    workflows,
  }
}
