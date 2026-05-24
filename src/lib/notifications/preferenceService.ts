import { NotificationType, type NotificationDigestFrequency } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import type { NotificationPreferenceDTO } from './types'

const ALL_TYPES: NotificationType[] = [
  'ALERT',
  'SYSTEM',
  'ACTIVITY',
  'MENTION',
  'REMINDER',
  'BILLING',
  'SECURITY',
]

export async function getPreferences(
  tenantId: string,
  userId: string,
): Promise<NotificationPreferenceDTO[]> {
  const existing = await prisma.notificationPreference.findMany({
    where: { tenantId, userId },
  })
  const map = new Map(existing.map((p) => [p.notificationType, p]))

  return ALL_TYPES.map((type) => {
    const pref = map.get(type)
    return {
      notificationType: type,
      inApp: pref?.inApp ?? true,
      email: pref?.email ?? type !== 'ACTIVITY',
      whatsapp: pref?.whatsapp ?? false,
      slack: pref?.slack ?? false,
      sms: pref?.sms ?? false,
      quietHoursStart: pref?.quietHoursStart ?? null,
      quietHoursEnd: pref?.quietHoursEnd ?? null,
      digest: pref?.digest ?? 'IMMEDIATE',
    }
  })
}

export async function upsertPreferences(
  tenantId: string,
  userId: string,
  prefs: NotificationPreferenceDTO[],
): Promise<NotificationPreferenceDTO[]> {
  for (const p of prefs) {
    await prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_notificationType: {
          tenantId,
          userId,
          notificationType: p.notificationType,
        },
      },
      create: {
        tenantId,
        userId,
        notificationType: p.notificationType,
        inApp: p.inApp,
        email: p.email,
        whatsapp: p.whatsapp,
        slack: p.slack,
        sms: p.sms,
        quietHoursStart: p.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd,
        digest: p.digest,
      },
      update: {
        inApp: p.inApp,
        email: p.email,
        whatsapp: p.whatsapp,
        slack: p.slack,
        sms: p.sms,
        quietHoursStart: p.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd,
        digest: p.digest,
      },
    })
  }
  return getPreferences(tenantId, userId)
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function isWithinQuietHours(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): boolean {
  if (!start || !end) return false
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = parseTime(start)
  const e = parseTime(end)
  if (s <= e) return cur >= s && cur < e
  return cur >= s || cur < e
}

export function getPreferenceForType(
  prefs: NotificationPreferenceDTO[],
  type: NotificationType,
): NotificationPreferenceDTO {
  return prefs.find((p) => p.notificationType === type) ?? {
    notificationType: type,
    inApp: true,
    email: true,
    whatsapp: false,
    slack: false,
    sms: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digest: 'IMMEDIATE' as NotificationDigestFrequency,
  }
}
