import webpush from 'web-push'
import { prisma } from '@/lib/db/prisma'

let vapidConfigured = false

function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:notifications@saios.app'
  if (!publicKey || !privateKey) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
  }
  return true
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys()
}

export async function sendPushNotification(
  tenantId: string,
  userId: string,
  payload: { title: string; body: string; url?: string; severity?: string },
): Promise<void> {
  if (!ensureVapid()) return

  const subs = await prisma.pushSubscription.findMany({
    where: { tenantId, userId },
  })

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/notifications',
    severity: payload.severity ?? 'INFO',
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    }),
  )
}

export async function handleExpiredSubscriptions(tenantId: string, userId: string): Promise<void> {
  void tenantId
  void userId
}
