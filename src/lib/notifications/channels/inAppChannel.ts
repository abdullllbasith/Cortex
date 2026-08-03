import type { NotificationSeverity, NotificationType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import type { NotificationDTO } from '../types'
import { publishNotificationEvent } from '../pubsub'
import { toNotificationDTO } from '../types'

export async function deliverInApp(
  row: Parameters<typeof toNotificationDTO>[0],
): Promise<NotificationDTO> {
  const dto = toNotificationDTO(row)
  await publishNotificationEvent(row.tenantId, row.userId, {
    type: 'notification',
    payload: dto,
  })
  return dto
}

export async function writeInAppNotification(params: {
  tenantId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  severity: NotificationSeverity
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
  expiresAt?: Date
}) {
  const row = await prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      severity: params.severity,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      metadata: (params.metadata ?? {}) as never,
      expiresAt: params.expiresAt,
    },
  })
  return deliverInApp(row)
}
