import { sendPushNotification, handleExpiredSubscriptions } from '../webPushService'

export async function sendPushToUser(params: {
  tenantId: string
  userId: string
  title: string
  body: string
  actionUrl?: string
  severity?: string
}): Promise<void> {
  await sendPushNotification(params.tenantId, params.userId, {
    title: params.title,
    body: params.body,
    url: params.actionUrl,
    severity: params.severity,
  })
  await handleExpiredSubscriptions(params.tenantId, params.userId)
}
