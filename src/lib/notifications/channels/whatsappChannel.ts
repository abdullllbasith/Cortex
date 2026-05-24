import { prisma } from '@/lib/db/prisma'

export async function sendWhatsAppNotification(params: {
  tenantId: string
  text: string
}): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return

  const conn = await prisma.channelConnection.findFirst({
    where: { tenantId: params.tenantId, channel: 'whatsapp', enabled: true },
  })
  const config = (conn?.config ?? {}) as { to?: string }
  const to = config.to
  if (!to) return

  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^wa:/, ''),
      type: 'text',
      text: { body: params.text.slice(0, 4096) },
    }),
  })
}
