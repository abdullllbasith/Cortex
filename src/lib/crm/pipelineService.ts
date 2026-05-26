import { ActivityType, DealStatus, NotificationSeverity, NotificationType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import type { PipelineStage } from './crmSchemas'

function toNumber(v: Decimal | number): number {
  return typeof v === 'number' ? v : v.toNumber()
}

export function parseStages(stages: unknown): PipelineStage[] {
  if (!Array.isArray(stages)) return []
  return stages as PipelineStage[]
}

export async function listPipelines(tenantId: string) {
  return prisma.crmPipeline.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })
}

export async function getDefaultPipeline(tenantId: string) {
  return prisma.crmPipeline.findFirst({
    where: { tenantId, isDefault: true },
  })
}

export async function upsertPipeline(
  tenantId: string,
  data: { id?: string; name: string; isDefault?: boolean; stages: PipelineStage[] },
) {
  if (data.isDefault) {
    await prisma.crmPipeline.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    })
  }

  if (data.id) {
    return prisma.crmPipeline.update({
      where: { id: data.id },
      data: {
        name: data.name,
        isDefault: data.isDefault ?? false,
        stages: data.stages as never,
      },
    })
  }

  return prisma.crmPipeline.create({
    data: {
      tenantId,
      name: data.name,
      isDefault: data.isDefault ?? false,
      stages: data.stages as never,
    },
  })
}

export interface DealListFilters {
  pipelineId?: string
  ownerId?: string
  valueMin?: number
  valueMax?: number
  closeFrom?: string
  closeTo?: string
}

export async function listDeals(tenantId: string, filters: DealListFilters = {}) {
  const closeFrom = filters.closeFrom ? new Date(filters.closeFrom) : undefined
  const closeTo = filters.closeTo ? new Date(filters.closeTo) : undefined

  const deals = await prisma.crmDeal.findMany({
    where: {
      tenantId,
      ...(filters.pipelineId && { pipelineId: filters.pipelineId }),
      ...(filters.ownerId && { ownerId: filters.ownerId }),
      status: DealStatus.OPEN,
      ...(filters.valueMin != null && { value: { gte: new Decimal(filters.valueMin) } }),
      ...(filters.valueMax != null && { value: { lte: new Decimal(filters.valueMax) } }),
      ...(closeFrom || closeTo
        ? {
            expectedCloseDate: {
              ...(closeFrom && { gte: closeFrom }),
              ...(closeTo && { lte: closeTo }),
            },
          }
        : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return deals.map((d) => ({
    ...d,
    value: toNumber(d.value),
    daysInStage: Math.floor((Date.now() - d.stageEnteredAt.getTime()) / 86400000),
  }))
}

export async function createDeal(tenantId: string, data: Record<string, unknown>, actorId?: string) {
  const pipeline = await prisma.crmPipeline.findFirst({
    where: { id: String(data.pipelineId), tenantId },
  })
  if (!pipeline) throw new Error('Pipeline not found')

  const stages = parseStages(pipeline.stages)
  const stageId = String(data.stageId)
  const stage = stages.find((s) => s.id === stageId)
  if (!stage) throw new Error('Invalid stage')

  return prisma.crmDeal.create({
    data: {
      tenantId,
      title: String(data.title),
      contactId: (data.contactId as string) ?? null,
      companyId: (data.companyId as string) ?? null,
      ownerId: (data.ownerId as string) ?? actorId ?? null,
      pipelineId: pipeline.id,
      stageId,
      value: new Decimal(Number(data.value ?? 0)),
      currency: String(data.currency ?? 'USD'),
      probability: data.probability != null ? Number(data.probability) : stage.probability,
      expectedCloseDate: data.expectedCloseDate ? new Date(String(data.expectedCloseDate)) : null,
    },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      company: { select: { name: true } },
      owner: { select: { fullName: true, avatarUrl: true } },
    },
  })
}

export async function updateDeal(tenantId: string, dealId: string, data: Record<string, unknown>) {
  const result = await prisma.crmDeal.updateMany({
    where: { id: dealId, tenantId },
    data: {
      ...(data.title !== undefined && { title: String(data.title) }),
      ...(data.value !== undefined && { value: new Decimal(Number(data.value)) }),
      ...(data.expectedCloseDate !== undefined && {
        expectedCloseDate: data.expectedCloseDate ? new Date(String(data.expectedCloseDate)) : null,
      }),
      ...(data.probability !== undefined && { probability: Number(data.probability) }),
      ...(data.ownerId !== undefined && { ownerId: (data.ownerId as string) ?? null }),
    },
  })
  if (!result.count) throw new Error('Deal not found')
  return prisma.crmDeal.findFirst({ where: { id: dealId, tenantId } })
}

export async function moveDeal(dealId: string, newStageId: string, tenantId: string, actorId?: string) {
  const deal = await prisma.crmDeal.findFirst({
    where: { id: dealId, tenantId },
    include: { pipeline: true },
  })
  if (!deal) throw new Error('Deal not found')
  if (deal.status !== DealStatus.OPEN) throw new Error('Cannot move closed deal')

  const stages = parseStages(deal.pipeline.stages)
  const stage = stages.find((s) => s.id === newStageId)
  if (!stage) throw new Error('Invalid stage')

  const updated = await prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      stageId: newStageId,
      probability: stage.probability,
      stageEnteredAt: new Date(),
    },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      company: { select: { name: true } },
      owner: { select: { fullName: true, avatarUrl: true } },
    },
  })

  await prisma.crmActivity.create({
    data: {
      tenantId,
      dealId,
      contactId: deal.contactId,
      type: ActivityType.NOTE,
      subject: `Moved to ${stage.name}`,
      description: `Deal stage changed to ${stage.name}`,
      createdBy: actorId ?? null,
      isCompleted: true,
      completedAt: new Date(),
    },
  })

  return {
    ...updated,
    value: toNumber(updated.value),
    daysInStage: 0,
  }
}

export async function wonDeal(
  dealId: string,
  tenantId: string,
  actualValue?: number,
  actorId?: string,
) {
  const deal = await prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      status: DealStatus.WON,
      wonAt: new Date(),
      probability: 100,
      ...(actualValue != null && !Number.isNaN(actualValue) ? { value: new Decimal(actualValue) } : {}),
    },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { id: true, fullName: true } },
    },
  })

  await prisma.crmActivity.create({
    data: {
      tenantId,
      dealId,
      contactId: deal.contactId,
      type: ActivityType.NOTE,
      subject: 'Deal won',
      description: `${deal.title} marked as won`,
      createdBy: actorId ?? null,
      isCompleted: true,
      completedAt: new Date(),
    },
  })

  await notificationService.send({
    tenantId,
    userId: deal.ownerId ?? undefined,
    roleTarget: deal.ownerId ? undefined : ['MANAGER', 'SALES_OFFICER'],
    type: NotificationType.ACTIVITY,
    severity: NotificationSeverity.INFO,
    title: 'Deal won!',
    body: `"${deal.title}" closed for ${deal.currency} ${toNumber(deal.value).toLocaleString()}`,
    actionUrl: '/crm/pipeline',
    actionLabel: 'View pipeline',
    entityId: `deal-won-${dealId}`,
    metadata: { dealId, value: toNumber(deal.value) },
  })

  emitSaiosEvent(tenantId, 'deal_won', {
    dealId,
    contactId: deal.contactId,
    title: deal.title,
    value: toNumber(deal.value),
    currency: deal.currency,
    ownerId: deal.ownerId,
  })

  return deal
}

export async function lostDeal(dealId: string, tenantId: string, reason: string, actorId?: string) {
  const deal = await prisma.crmDeal.update({
    where: { id: dealId },
    data: {
      status: DealStatus.LOST,
      lostAt: new Date(),
      lostReason: reason,
      probability: 0,
    },
    include: { contact: true },
  })

  await prisma.crmActivity.create({
    data: {
      tenantId,
      dealId,
      contactId: deal.contactId,
      type: ActivityType.NOTE,
      subject: 'Deal lost',
      description: reason,
      createdBy: actorId ?? null,
      isCompleted: true,
      completedAt: new Date(),
    },
  })

  const reengageAt = new Date(Date.now() + 90 * 86400000)
  if (deal.contactId) {
    await prisma.crmContact.updateMany({
      where: { id: deal.contactId },
      data: { nextFollowUpAt: reengageAt },
    })
  }

  await prisma.crmActivity.create({
    data: {
      tenantId,
      dealId,
      contactId: deal.contactId,
      type: ActivityType.TASK,
      subject: 'Re-engagement after lost deal',
      description: `90-day follow-up for lost deal "${deal.title}". Reason: ${reason}`,
      scheduledAt: reengageAt,
      assignedTo: deal.ownerId,
      createdBy: actorId ?? null,
      isCompleted: false,
    },
  })

  emitSaiosEvent(tenantId, 'deal_lost', {
    dealId,
    contactId: deal.contactId,
    lostReason: reason,
    value: toNumber(deal.value),
    reengageAt: reengageAt.toISOString(),
    title: deal.title,
  })

  return deal
}

export async function calculatePipelineValue(tenantId: string, pipelineId?: string) {
  const deals = await prisma.crmDeal.findMany({
    where: {
      tenantId,
      status: DealStatus.OPEN,
      ...(pipelineId && { pipelineId }),
    },
    select: { stageId: true, value: true, probability: true },
  })

  let totalValue = 0
  let weightedValue = 0
  const byStage = new Map<string, { count: number; value: number }>()

  for (const d of deals) {
    const val = toNumber(d.value)
    totalValue += val
    weightedValue += val * (d.probability / 100)
    const existing = byStage.get(d.stageId) ?? { count: 0, value: 0 }
    byStage.set(d.stageId, { count: existing.count + 1, value: existing.value + val })
  }

  return {
    totalValue,
    weightedValue,
    dealsByStage: [...byStage.entries()].map(([stageId, stats]) => ({ stageId, ...stats })),
    dealCount: deals.length,
  }
}

/** Default pipeline seeded for new tenants (Stage 2 spec). */
export const DEFAULT_PIPELINES: Array<{ name: string; isDefault: boolean; stages: PipelineStage[] }> = [
  {
    name: 'Sales Pipeline',
    isDefault: true,
    stages: [
      { id: 'lead', name: 'Lead', order: 0, probability: 10, color: '#94a3b8', rottenDays: 14 },
      { id: 'contacted', name: 'Contacted', order: 1, probability: 20, color: '#6366f1', rottenDays: 14 },
      { id: 'demo', name: 'Demo', order: 2, probability: 40, color: '#3b82f6', rottenDays: 21 },
      { id: 'proposal', name: 'Proposal', order: 3, probability: 60, color: '#8b5cf6', rottenDays: 21 },
      { id: 'negotiation', name: 'Negotiation', order: 4, probability: 80, color: '#f59e0b', rottenDays: 30 },
      { id: 'won', name: 'Won', order: 5, probability: 100, color: '#10b981' },
      { id: 'lost', name: 'Lost', order: 6, probability: 0, color: '#ef4444' },
    ],
  },
]

export async function seedPipelinesForTenant(tenantId: string) {
  const existing = await prisma.crmPipeline.count({ where: { tenantId } })
  if (existing > 0) return

  for (const p of DEFAULT_PIPELINES) {
    await prisma.crmPipeline.create({
      data: {
        tenantId,
        name: p.name,
        isDefault: p.isDefault,
        stages: p.stages as never,
      },
    })
  }
}
