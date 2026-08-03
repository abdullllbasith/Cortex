import { prisma } from '@/lib/db/prisma'
import { SalesAgent } from '@/lib/agents/SalesAgent'
import { findDealByTitle, resolveStageId } from './actionExecutor'
import type { ActionTaken, IntentClassification } from '../types'
import { completedAction, confirmationAction, failedAction } from './actionUtils'

async function findContactByName(tenantId: string, name: string) {
  if (!name) return null
  const parts = name.trim().split(/\s+/)
  return prisma.crmContact.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        {
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            parts[1] ? { lastName: { contains: parts[1], mode: 'insensitive' } } : {},
          ],
        },
        { company: { contains: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  })
}

function parseFollowUpDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (/tomorrow/i.test(raw)) return tomorrow
  if (/next week/i.test(raw)) {
    tomorrow.setDate(tomorrow.getDate() + 7)
    return tomorrow
  }
  return null
}

export async function handleCrmAction(
  tenantId: string,
  userId: string,
  message: string,
  classification: IntentClassification,
): Promise<ActionTaken[]> {
  const lower = message.toLowerCase()
  const contactName = String(classification.entities.contactName ?? '').trim()
  const dealTitle = String(classification.entities.dealTitle ?? '').trim()
  const stageName = String(classification.entities.stageName ?? '').trim()
  const followUpDate = String(classification.entities.followUpDate ?? '').trim()

  if (/\b(my\s+)?leads?\b/i.test(lower) && !/\b(create|add)\b/i.test(lower)) {
    const leads = await prisma.crmContact.findMany({
      where: {
        tenantId,
        type: 'LEAD',
        isActive: true,
        ownerId: userId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const lines = leads
      .map(
        (l) =>
          `• ${l.firstName} ${l.lastName}`.trim() +
          (l.company ? ` (${l.company})` : '') +
          (l.email ? ` — ${l.email}` : ''),
      )
      .join('\n')

    return [
      completedAction({
        type: 'crm.my_leads',
        description:
          leads.length > 0
            ? `Your ${leads.length} lead(s):\n${lines}`
            : 'You have no leads assigned',
      }),
    ]
  }

  if (/\blog\s+(a\s+)?call\b/i.test(lower) && contactName) {
    const contact = await findContactByName(tenantId, contactName)
    if (!contact) {
      return [failedAction(`Contact "${contactName}" not found`, 'crm.log_call')]
    }

    return [
      confirmationAction({
        type: 'crm.log_call',
        description: `Log a completed call with ${contact.firstName} ${contact.lastName}`.trim(),
        displayTitle: 'Log call activity',
        parameters: [
          { label: 'Contact', value: `${contact.firstName} ${contact.lastName}`.trim() },
        ],
        executePayload: {
          contactId: contact.id,
          subject: `Call with ${contact.firstName} ${contact.lastName}`.trim(),
        },
        entityType: 'contact',
        entityId: contact.id,
      }),
    ]
  }

  if (/\b(schedule|set)\b.*\bfollow[- ]?up\b/i.test(lower) && contactName) {
    const contact = await findContactByName(tenantId, contactName)
    if (!contact) {
      return [failedAction(`Contact "${contactName}" not found`, 'crm.schedule_followup')]
    }

    const date =
      parseFollowUpDate(followUpDate) ||
      parseFollowUpDate(message.match(/\bon\s+([\w\s,/-]+)/i)?.[1] ?? '') ||
      (() => {
        const d = new Date()
        d.setDate(d.getDate() + 3)
        return d
      })()

    return [
      confirmationAction({
        type: 'crm.schedule_followup',
        description: `Schedule follow-up with ${contact.firstName} ${contact.lastName}`.trim(),
        displayTitle: 'Schedule follow-up',
        parameters: [
          { label: 'Contact', value: `${contact.firstName} ${contact.lastName}`.trim() },
          { label: 'Date', value: date.toLocaleDateString() },
        ],
        executePayload: {
          contactId: contact.id,
          dateIso: date.toISOString(),
          assignTo: userId,
        },
        entityType: 'contact',
        entityId: contact.id,
      }),
    ]
  }

  if (/\bmove\b.*\b(deal|to)\b/i.test(lower) && (dealTitle || stageName)) {
    const deal = await findDealByTitle(tenantId, dealTitle)
    if (!deal) {
      return [failedAction(`Deal "${dealTitle || '?'}" not found`, 'crm.move_deal')]
    }
    const stageId = await resolveStageId(deal.pipeline.stages, stageName)
    if (!stageId) {
      return [failedAction(`Stage "${stageName}" not found in pipeline`, 'crm.move_deal')]
    }

    return [
      confirmationAction({
        type: 'crm.move_deal',
        description: `Move "${deal.title}" to stage "${stageName}"`,
        displayTitle: 'Move deal stage',
        parameters: [
          { label: 'Deal', value: deal.title },
          { label: 'New stage', value: stageName },
        ],
        executePayload: { dealId: deal.id, stageId },
        entityType: 'deal',
        entityId: deal.id,
      }),
    ]
  }

  if (/\b(pipeline|rotten|deals?\s+need)\b/i.test(lower)) {
    const sales = new SalesAgent(tenantId)
    const [pipeline, attention] = await Promise.all([
      sales.getPipelineValue(),
      sales.getDealsNeedingAttention(),
    ])
    return [
      completedAction({
        type: 'crm.pipeline_snapshot',
        description: `Pipeline: $${pipeline.totalValue.toLocaleString()} (${pipeline.dealCount} deals); ${attention.count} deal(s) need attention`,
        undoPayload: { pipeline, attention },
      }),
    ]
  }

  return []
}

export async function undoCrmAction(_tenantId: string, _action: ActionTaken): Promise<boolean> {
  return false
}
