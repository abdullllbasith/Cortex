import { NotificationSeverity, NotificationType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'

const processedKeys = new Set<string>()

/** Check overdue contact follow-ups and scheduled activities → emit follow_up_due + notify assignee. */
export async function runFollowUpDueCheck(tenantId: string): Promise<number> {
  const now = new Date()
  const dayKey = now.toISOString().slice(0, 10)
  let emitted = 0

  const overdueContacts = await prisma.crmContact.findMany({
    where: {
      tenantId,
      isActive: true,
      nextFollowUpAt: { lte: now },
      ownerId: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ownerId: true,
      nextFollowUpAt: true,
      email: true,
    },
  })

  for (const contact of overdueContacts) {
    const dedupeKey = `contact:${tenantId}:${contact.id}:${dayKey}`
    if (processedKeys.has(dedupeKey)) continue
    processedKeys.add(dedupeKey)

    emitSaiosEvent(tenantId, 'follow_up_due', {
      contactId: contact.id,
      ownerId: contact.ownerId,
      fullName: `${contact.firstName} ${contact.lastName}`.trim(),
      email: contact.email,
      nextFollowUpAt: contact.nextFollowUpAt?.toISOString(),
      source: 'contact_next_follow_up',
    })

    if (contact.ownerId) {
      await notificationService
        .send({
          tenantId,
          userId: contact.ownerId,
          type: NotificationType.TASK,
          severity: NotificationSeverity.WARNING,
          title: 'Follow-up overdue',
          body: `${contact.firstName} ${contact.lastName} — follow-up was due ${contact.nextFollowUpAt?.toLocaleDateString() ?? 'now'}`,
          actionUrl: `/crm/contacts/${contact.id}`,
          actionLabel: 'View contact',
          entityId: `follow-up-due-${contact.id}-${dayKey}`,
        })
        .catch(() => undefined)
    }
    emitted += 1
  }

  const dueActivities = await prisma.crmActivity.findMany({
    where: {
      tenantId,
      isCompleted: false,
      scheduledAt: { lte: now },
      assignedTo: { not: null },
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, fullName: true } },
    },
  })

  for (const activity of dueActivities) {
    const dedupeKey = `activity:${tenantId}:${activity.id}:${dayKey}`
    if (processedKeys.has(dedupeKey)) continue
    processedKeys.add(dedupeKey)

    const contactName = activity.contact
      ? `${activity.contact.firstName} ${activity.contact.lastName}`.trim()
      : null

    emitSaiosEvent(tenantId, 'follow_up_due', {
      activityId: activity.id,
      contactId: activity.contactId,
      assignedTo: activity.assignedTo,
      subject: activity.subject,
      scheduledAt: activity.scheduledAt?.toISOString(),
      source: 'scheduled_activity',
    })

    if (activity.assignedTo) {
      await notificationService
        .send({
          tenantId,
          userId: activity.assignedTo,
          type: NotificationType.TASK,
          severity: NotificationSeverity.WARNING,
          title: 'Scheduled activity due',
          body: activity.subject + (contactName ? ` — ${contactName}` : ''),
          actionUrl: activity.contactId ? `/crm/contacts/${activity.contactId}` : '/crm',
          actionLabel: 'Open',
          entityId: `activity-due-${activity.id}-${dayKey}`,
        })
        .catch(() => undefined)
    }
    emitted += 1
  }

  if (processedKeys.size > 5000) processedKeys.clear()
  return emitted
}

export async function runFollowUpDueCheckAllTenants(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })
  for (const t of tenants) {
    await runFollowUpDueCheck(t.id)
  }
}
