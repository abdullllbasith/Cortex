import type {
  NotificationDigestFrequency,
  NotificationSeverity,
  NotificationType,
  UserRole,
} from '@prisma/client'

export interface NotificationPayload {
  tenantId: string
  userId?: string
  userIds?: string[]
  roleTarget?: UserRole | UserRole[]
  title: string
  body: string
  type: NotificationType
  severity?: NotificationSeverity
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
  expiresAt?: Date
  /** Used for deduplication window (type + entityId within 30 min) */
  entityId?: string
}

export interface NotificationDTO {
  id: string
  tenantId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  severity: NotificationSeverity
  isRead: boolean
  readAt: string | null
  actionUrl: string | null
  actionLabel: string | null
  metadata: Record<string, unknown>
  expiresAt: string | null
  createdAt: string
}

export interface NotificationPreferenceDTO {
  notificationType: NotificationType
  inApp: boolean
  email: boolean
  whatsapp: boolean
  slack: boolean
  sms: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  digest: NotificationDigestFrequency
}

export type SseEvent =
  | { type: 'notification'; payload: NotificationDTO }
  | { type: 'read_all' }
  | { type: 'heartbeat' }

export function toNotificationDTO(row: {
  id: string
  tenantId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  severity: NotificationSeverity
  isRead: boolean
  readAt: Date | null
  actionUrl: string | null
  actionLabel: string | null
  metadata: unknown
  expiresAt: Date | null
  createdAt: Date
}): NotificationDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: row.severity,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    actionUrl: row.actionUrl,
    actionLabel: row.actionLabel,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
