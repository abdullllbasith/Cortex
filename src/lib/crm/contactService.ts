import {
  ActivityType,
  EmbeddingStatus,
  NotificationSeverity,
  NotificationType,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { hashEmbeddingContent } from '@/lib/embeddings/types'
import { embedSingleRecord } from '@/lib/embeddings/knowledgeIndexer'
import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import { notificationService } from '@/lib/notifications/notificationService'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'

export interface ContactFilters {
  segment?: 'all' | 'mine' | 'new' | 'overdue' | 'high_value'
  ownerId?: string
  userId?: string
  search?: string
  semantic?: boolean
  type?: string
  page?: number
  limit?: number
}

export interface CreateContactResult {
  contact: Awaited<ReturnType<typeof getContact>>
  warnings: string[]
}

function buildContactContent(contact: {
  firstName: string
  lastName: string
  email: string | null
  company: string | null
  jobTitle: string | null
  notes: string | null
  tags: string[]
}): string {
  return [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.company,
    contact.jobTitle,
    contact.notes,
    contact.tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
}

async function resolveHighValueContactIds(tenantId: string): Promise<string[]> {
  const deals = await prisma.crmDeal.findMany({
    where: { tenantId, status: 'OPEN', contactId: { not: null } },
    select: { contactId: true, value: true },
  })
  const byContact = new Map<string, number>()
  for (const d of deals) {
    if (!d.contactId) continue
    byContact.set(d.contactId, (byContact.get(d.contactId) ?? 0) + d.value.toNumber())
  }
  const values = [...byContact.values()].sort((a, b) => a - b)
  if (!values.length) return []
  const thresholdIdx = Math.floor(values.length * 0.8)
  const threshold = values[thresholdIdx] ?? 0
  return [...byContact.entries()].filter(([, v]) => v >= threshold && v > 0).map(([id]) => id)
}

async function searchContactsSemantic(tenantId: string, query: string, limit: number) {
  const results = await semanticSearch({
    tenantId,
    query,
    entityType: 'contact',
    topK: limit,
  })
  if (!results.length) return []
  const ids = results.map((r) => r.id)
  const contacts = await prisma.crmContact.findMany({
    where: { tenantId, id: { in: ids }, isActive: true },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      deals: { where: { status: 'OPEN' }, select: { value: true } },
      _count: { select: { deals: true } },
    },
  })
  const order = new Map(ids.map((id, i) => [id, i]))
  return contacts
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    .map((c) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}`.trim(),
      openDealValue: c.deals.reduce((s, d) => s + d.value.toNumber(), 0),
      dealCount: c._count.deals,
      searchMode: 'semantic' as const,
    }))
}

export async function listContacts(tenantId: string, filters: ContactFilters = {}) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 24
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  if (filters.search && filters.search.trim().length >= 2 && filters.semantic !== false) {
    const semanticItems = await searchContactsSemantic(tenantId, filters.search.trim(), limit)
    if (semanticItems.length) {
      return { items: semanticItems, total: semanticItems.length, page: 1, limit, searchMode: 'semantic' }
    }
  }

  const where: Prisma.CrmContactWhereInput = {
    tenantId,
    isActive: true,
    ...(filters.search && {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
    ...(filters.type && { type: filters.type as Prisma.EnumContactTypeFilter['equals'] }),
  }

  if (filters.segment === 'mine' && filters.userId) {
    where.ownerId = filters.userId
  }
  if (filters.segment === 'new') {
    where.createdAt = { gte: weekAgo }
  }
  if (filters.segment === 'overdue') {
    where.nextFollowUpAt = { lt: now }
  }
  if (filters.segment === 'high_value') {
    const ids = await resolveHighValueContactIds(tenantId)
    where.id = ids.length ? { in: ids } : { in: ['__none__'] }
  }
  if (filters.ownerId) where.ownerId = filters.ownerId

  const [items, total] = await Promise.all([
    prisma.crmContact.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true } },
        deals: { where: { status: 'OPEN' }, select: { value: true } },
        _count: { select: { deals: true } },
      },
    }),
    prisma.crmContact.count({ where }),
  ])

  return {
    items: items.map((c) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}`.trim(),
      openDealValue: c.deals.reduce((s, d) => s + d.value.toNumber(), 0),
      dealCount: c._count.deals,
    })),
    total,
    page,
    limit,
  }
}

export async function getContact(tenantId: string, id: string) {
  return prisma.crmContact.findFirst({
    where: { id, tenantId },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
      companies: { include: { company: true } },
      deals: { where: { status: 'OPEN' }, select: { id: true, title: true, value: true, stageId: true } },
    },
  })
}

export async function checkEmailDuplicate(tenantId: string, email: string | null | undefined) {
  if (!email?.trim()) return null
  return prisma.crmContact.findFirst({
    where: { tenantId, email: email.trim(), isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
}

export async function createContact(
  tenantId: string,
  data: Record<string, unknown>,
  actorId?: string,
): Promise<CreateContactResult> {
  const warnings: string[] = []
  const email = (data.email as string)?.trim() ?? null
  const duplicate = await checkEmailDuplicate(tenantId, email)
  if (duplicate) {
    warnings.push(
      `A contact with email ${email} already exists (${duplicate.firstName} ${duplicate.lastName})`,
    )
  }

  const content = buildContactContent({
    firstName: String(data.firstName),
    lastName: String(data.lastName),
    email: (data.email as string) ?? null,
    company: (data.company as string) ?? null,
    jobTitle: (data.jobTitle as string) ?? null,
    notes: (data.notes as string) ?? null,
    tags: (data.tags as string[]) ?? [],
  })
  const contentHash = hashEmbeddingContent(content)

  const contact = await prisma.crmContact.create({
    data: {
      tenantId,
      type: (data.type as Prisma.CrmContactCreateInput['type']) ?? 'LEAD',
      firstName: String(data.firstName),
      lastName: String(data.lastName),
      email: (data.email as string) ?? null,
      phone: (data.phone as string) ?? null,
      mobile: (data.mobile as string) ?? null,
      company: (data.company as string) ?? null,
      jobTitle: (data.jobTitle as string) ?? null,
      source: (data.source as Prisma.CrmContactCreateInput['source']) ?? 'MANUAL',
      ownerId: (data.ownerId as string) ?? actorId ?? null,
      tags: (data.tags as string[]) ?? [],
      notes: (data.notes as string) ?? null,
      address: (data.address as Prisma.InputJsonValue) ?? {},
      customFields: (data.customFields as Prisma.InputJsonValue) ?? {},
      doNotContact: Boolean(data.doNotContact),
      nextFollowUpAt: data.nextFollowUpAt ? new Date(String(data.nextFollowUpAt)) : null,
      embeddingStatus: EmbeddingStatus.PENDING,
      embeddingContentHash: contentHash,
    },
  })

  void embedSingleRecord(tenantId, 'contact', contact.id).catch(() => {})

  emitSaiosEvent(tenantId, 'new_contact_created', {
    contactId: contact.id,
    source: contact.source,
    type: contact.type,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    ownerId: contact.ownerId,
  })

  const full = await getContact(tenantId, contact.id)
  return { contact: full, warnings }
}

export async function updateContact(tenantId: string, id: string, data: Record<string, unknown>) {
  const contact = await prisma.crmContact.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.firstName !== undefined && { firstName: String(data.firstName) }),
      ...(data.lastName !== undefined && { lastName: String(data.lastName) }),
      ...(data.email !== undefined && { email: (data.email as string) ?? null }),
      ...(data.phone !== undefined && { phone: (data.phone as string) ?? null }),
      ...(data.mobile !== undefined && { mobile: (data.mobile as string) ?? null }),
      ...(data.company !== undefined && { company: (data.company as string) ?? null }),
      ...(data.jobTitle !== undefined && { jobTitle: (data.jobTitle as string) ?? null }),
      ...(data.type !== undefined && { type: data.type as Prisma.CrmContactUpdateManyMutationInput['type'] }),
      ...(data.ownerId !== undefined && { ownerId: (data.ownerId as string) ?? null }),
      ...(data.tags !== undefined && { tags: data.tags as string[] }),
      ...(data.notes !== undefined && { notes: (data.notes as string) ?? null }),
      ...(data.doNotContact !== undefined && { doNotContact: Boolean(data.doNotContact) }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      ...(data.address !== undefined && { address: data.address as Prisma.InputJsonValue }),
      ...(data.customFields !== undefined && {
        customFields: data.customFields as Prisma.InputJsonValue,
      }),
      ...(data.nextFollowUpAt !== undefined && {
        nextFollowUpAt: data.nextFollowUpAt ? new Date(String(data.nextFollowUpAt)) : null,
      }),
      ...(data.ownerId !== undefined && { ownerId: (data.ownerId as string) ?? null }),
      embeddingStatus: EmbeddingStatus.PENDING,
    },
  })
  if (!contact.count) throw new Error('Contact not found')
  void embedSingleRecord(tenantId, 'contact', id).catch(() => {})
  return getContact(tenantId, id)
}

export async function deleteContact(tenantId: string, id: string) {
  await prisma.crmContact.updateMany({
    where: { id, tenantId },
    data: { isActive: false },
  })
  return { deleted: true }
}

export async function findDuplicates(tenantId: string) {
  const contacts = await prisma.crmContact.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  const byEmail = new Map<string, typeof contacts>()
  for (const c of contacts) {
    if (!c.email) continue
    const key = c.email.toLowerCase()
    const list = byEmail.get(key) ?? []
    list.push(c)
    byEmail.set(key, list)
  }

  const emailDuplicates = [...byEmail.values()].filter((g) => g.length > 1)

  const vectorPairs = await prisma.$queryRaw<
    Array<{
      idA: string
      idB: string
      firstNameA: string
      lastNameA: string
      firstNameB: string
      lastNameB: string
      similarity: number
    }>
  >`
    SELECT a.id AS "idA", b.id AS "idB",
           a."firstName" AS "firstNameA", a."lastName" AS "lastNameA",
           b."firstName" AS "firstNameB", b."lastName" AS "lastNameB",
           (1 - (a.embedding <=> b.embedding))::float AS similarity
    FROM crm_contacts a
    INNER JOIN crm_contacts b
      ON a."tenantId" = b."tenantId" AND a.id < b.id
    WHERE a."tenantId" = ${tenantId}
      AND a.embedding IS NOT NULL
      AND b.embedding IS NOT NULL
      AND a."isActive" = true
      AND b."isActive" = true
      AND (1 - (a.embedding <=> b.embedding)) > 0.85
  `

  const nameSimilarities = vectorPairs.map((p) => [
    {
      id: p.idA,
      firstName: p.firstNameA,
      lastName: p.lastNameA,
      email: null as string | null,
    },
    {
      id: p.idB,
      firstName: p.firstNameB,
      lastName: p.lastNameB,
      email: null as string | null,
    },
  ])

  return { emailDuplicates, nameSimilarities, vectorSimilarities: vectorPairs }
}

export async function scheduleFollowUp(
  tenantId: string,
  contactId: string,
  date: Date,
  assignTo?: string,
  createdBy?: string,
) {
  const contact = await prisma.crmContact.findFirst({
    where: { id: contactId, tenantId },
    select: { firstName: true, lastName: true },
  })
  if (!contact) throw new Error('Contact not found')

  const contactName = `${contact.firstName} ${contact.lastName}`.trim()

  await prisma.crmContact.updateMany({
    where: { id: contactId, tenantId },
    data: { nextFollowUpAt: date },
  })

  const activity = await prisma.crmActivity.create({
    data: {
      tenantId,
      type: ActivityType.TASK,
      contactId,
      subject: `Follow up with ${contactName}`,
      description: `Scheduled follow-up on ${date.toLocaleDateString()}`,
      scheduledAt: date,
      assignedTo: assignTo ?? null,
      createdBy: createdBy ?? null,
      isCompleted: false,
    },
  })

  if (assignTo) {
    await notificationService.send({
      tenantId,
      userId: assignTo,
      type: NotificationType.REMINDER,
      severity: NotificationSeverity.INFO,
      title: 'Follow-up assigned',
      body: `Follow up with ${contactName} on ${date.toLocaleDateString()}`,
      actionUrl: `/crm/contacts/${contactId}`,
      actionLabel: 'View contact',
      entityId: `follow-up-${activity.id}`,
    }).catch(() => undefined)
  }

  return activity
}

export interface ContactActivityFilters {
  type?: string
  assigneeId?: string
  dateFrom?: string
  dateTo?: string
}

export async function listContactActivities(
  tenantId: string,
  contactId: string,
  filters: ContactActivityFilters = {},
) {
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined

  return prisma.crmActivity.findMany({
    where: {
      tenantId,
      contactId,
      ...(filters.type && { type: filters.type as ActivityType }),
      ...(filters.assigneeId && { assignedTo: filters.assigneeId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, fullName: true } },
      assignee: { select: { id: true, fullName: true } },
    },
  })
}

export async function createContactActivity(
  tenantId: string,
  contactId: string,
  data: Record<string, unknown>,
  createdBy?: string,
) {
  const activity = await prisma.crmActivity.create({
    data: {
      tenantId,
      contactId,
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
      dealId: (data.dealId as string) ?? null,
      companyId: (data.companyId as string) ?? null,
    },
  })

  if (data.isCompleted || data.type === 'CALL' || data.type === 'EMAIL' || data.type === 'MEETING') {
    await prisma.crmContact.updateMany({
      where: { id: contactId, tenantId },
      data: { lastContactedAt: new Date() },
    })
  }

  return activity
}
