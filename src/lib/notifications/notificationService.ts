import {
  NotificationSeverity,
  NotificationType,
  UserRole,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { cacheGet, cacheSet } from '@/lib/cache/redis'
import type { NotificationPayload } from './types'
import { writeInAppNotification } from './channels/inAppChannel'
import { sendEmailNotification, formatEmailHtml } from './channels/emailChannel'
import { sendSlackNotification } from './channels/slackChannel'
import { sendWhatsAppNotification } from './channels/whatsappChannel'
import { sendPushToUser } from './channels/pushChannel'
import { queueForDigest } from './channels/digestChannel'
import {
  getPreferenceForType,
  getPreferences,
  isWithinQuietHours,
} from './preferenceService'
import { publishReadAllEvent } from './pubsub'

const DEDUP_MINUTES = 30

function dedupKey(tenantId: string, userId: string, type: NotificationType, entityId?: string): string {
  return `saios:notif:dedup:${tenantId}:${userId}:${type}:${entityId ?? 'none'}`
}

async function isDuplicate(
  tenantId: string,
  userId: string,
  type: NotificationType,
  entityId?: string,
): Promise<boolean> {
  const key = dedupKey(tenantId, userId, type, entityId)
  const hit = await cacheGet<string>(key)
  if (hit) return true
  await cacheSet(key, '1', DEDUP_MINUTES * 60)
  return false
}

async function resolveTargetUserIds(payload: NotificationPayload): Promise<string[]> {
  if (payload.userId) return [payload.userId]
  if (payload.userIds?.length) return payload.userIds

  const roles = payload.roleTarget
    ? Array.isArray(payload.roleTarget) ? payload.roleTarget : [payload.roleTarget]
    : null

  const users = await prisma.user.findMany({
    where: {
      tenantId: payload.tenantId,
      isActive: true,
      ...(roles ? { role: { in: roles as UserRole[] } } : {}),
    },
    select: { id: true },
  })

  if (users.length) return users.map((u) => u.id)

  const owners = await prisma.user.findMany({
    where: { tenantId: payload.tenantId, role: 'OWNER', isActive: true },
    select: { id: true },
  })
  return owners.map((o) => o.id)
}

async function deliverToUser(
  payload: NotificationPayload,
  userId: string,
): Promise<void> {
  const dup = await isDuplicate(payload.tenantId, userId, payload.type, payload.entityId)
  if (dup) return

  const prefsList = await getPreferences(payload.tenantId, userId)
  const pref = getPreferenceForType(prefsList, payload.type)
  const quiet = isWithinQuietHours(pref.quietHoursStart, pref.quietHoursEnd)

  if (quiet && pref.digest !== 'IMMEDIATE') {
    await queueForDigest({
      tenantId: payload.tenantId,
      userId,
      digestType: pref.digest,
      notification: {
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
      },
    })
    return
  }

  if (quiet) {
    const start = pref.quietHoursEnd ?? '08:00'
    const [h, m] = start.split(':').map(Number)
    const sendAt = new Date()
    sendAt.setHours(h ?? 8, m ?? 0, 0, 0)
    if (sendAt <= new Date()) sendAt.setDate(sendAt.getDate() + 1)
    const { enqueueNotification } = await import('./queue/notificationQueue')
    await enqueueNotification({ ...payload, userId }, { delayMs: sendAt.getTime() - Date.now() })
    return
  }

  const severity = payload.severity ?? NotificationSeverity.INFO

  if (pref.inApp) {
    await writeInAppNotification({
      tenantId: payload.tenantId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      severity,
      actionUrl: payload.actionUrl,
      actionLabel: payload.actionLabel,
      metadata: payload.metadata,
      expiresAt: payload.expiresAt,
    })
  }

  const text = `[${severity}] ${payload.title}\n${payload.body}`

  if (pref.digest !== 'IMMEDIATE') {
    await queueForDigest({
      tenantId: payload.tenantId,
      userId,
      digestType: pref.digest,
      notification: {
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
      },
    })
  } else if (pref.email) {
    await sendEmailNotification({
      tenantId: payload.tenantId,
      userId,
      subject: payload.title,
      text: payload.body,
      html: formatEmailHtml(payload.title, payload.body, payload.actionUrl, payload.actionLabel),
    })
  }

  if (pref.whatsapp) {
    await sendWhatsAppNotification({ tenantId: payload.tenantId, text })
  }
  if (pref.slack) {
    await sendSlackNotification({ tenantId: payload.tenantId, text })
  }

  await sendPushToUser({
    tenantId: payload.tenantId,
    userId,
    title: payload.title,
    body: payload.body,
    actionUrl: payload.actionUrl,
    severity,
  })
}

class NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    const userIds = await resolveTargetUserIds(payload)
    await Promise.all(userIds.map((userId) => deliverToUser(payload, userId)))
  }

  async sendBulk(tenantId: string, notifications: NotificationPayload[]): Promise<void> {
    for (const n of notifications) {
      await this.send({ ...n, tenantId })
    }
  }

  async schedule(payload: NotificationPayload, sendAt: Date): Promise<void> {
    const delayMs = Math.max(0, sendAt.getTime() - Date.now())
    const { enqueueNotification } = await import('./queue/notificationQueue')
    await enqueueNotification(payload, { delayMs })
  }
}

export const notificationService = new NotificationService()

export async function listNotifications(params: {
  tenantId: string
  userId: string
  isRead?: boolean
  type?: NotificationType
  severity?: NotificationSeverity
  page?: number
  limit?: number
  search?: string
}) {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const where = {
    tenantId: params.tenantId,
    userId: params.userId,
    ...(params.isRead !== undefined ? { isRead: params.isRead } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.severity ? { severity: params.severity } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' as const } },
            { body: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { tenantId: params.tenantId, userId: params.userId, isRead: false },
    }),
  ])

  return { notifications, totalCount, unreadCount, page, limit }
}

export async function markNotificationRead(
  tenantId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, tenantId, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return result.count > 0
}

export async function markAllNotificationsRead(tenantId: string, userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { tenantId, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  if (result.count > 0) {
    await publishReadAllEvent(tenantId, userId)
  }
  return result.count
}

export async function deleteNotification(
  tenantId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.notification.deleteMany({
    where: { id, tenantId, userId },
  })
  return result.count > 0
}

export async function clearReadNotifications(tenantId: string, userId: string): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { tenantId, userId, isRead: true },
  })
  return result.count
}
