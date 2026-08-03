import { z } from 'zod'
import { NotificationDigestFrequency, NotificationSeverity, NotificationType } from '@prisma/client'

export const notificationListQuerySchema = z.object({
  isRead: z.enum(['true', 'false']).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  severity: z.nativeEnum(NotificationSeverity).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

export const preferenceSchema = z.object({
  notificationType: z.nativeEnum(NotificationType),
  inApp: z.boolean(),
  email: z.boolean(),
  whatsapp: z.boolean(),
  slack: z.boolean(),
  sms: z.boolean(),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
  digest: z.nativeEnum(NotificationDigestFrequency),
})

export const preferencesUpdateSchema = z.object({
  preferences: z.array(preferenceSchema).min(1),
})

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
})

export const testNotificationSchema = z.object({
  templateKey: z.string().optional(),
})
