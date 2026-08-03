import { ActivityType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export async function listActivities(
  tenantId: string,
  filters: {
    contactId?: string
    dealId?: string
    companyId?: string
    type?: string
    isCompleted?: boolean
    page?: number
    limit?: number
  } = {},
) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 50

  const where: Prisma.CrmActivityWhereInput = {
    tenantId,
    ...(filters.contactId && { contactId: filters.contactId }),
    ...(filters.dealId && { dealId: filters.dealId }),
    ...(filters.companyId && { companyId: filters.companyId }),
    ...(filters.type && { type: filters.type as ActivityType }),
    ...(filters.isCompleted !== undefined && { isCompleted: filters.isCompleted }),
  }

  const [items, total] = await Promise.all([
    prisma.crmActivity.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        creator: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    prisma.crmActivity.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function createActivity(
  tenantId: string,
  data: Record<string, unknown>,
  createdBy?: string,
) {
  return prisma.crmActivity.create({
    data: {
      tenantId,
      type: data.type as ActivityType,
      subject: String(data.subject),
      description: (data.description as string) ?? null,
      outcome: (data.outcome as string) ?? null,
      scheduledAt: data.scheduledAt ? new Date(String(data.scheduledAt)) : null,
      completedAt: data.completedAt ? new Date(String(data.completedAt)) : null,
      duration: data.duration != null ? Number(data.duration) : null,
      assignedTo: (data.assignedTo as string) ?? null,
      createdBy: createdBy ?? null,
      isCompleted: Boolean(data.isCompleted),
      contactId: (data.contactId as string) ?? null,
      dealId: (data.dealId as string) ?? null,
      companyId: (data.companyId as string) ?? null,
    },
    include: {
      creator: { select: { fullName: true } },
      assignee: { select: { fullName: true } },
    },
  })
}
