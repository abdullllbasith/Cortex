import { prisma } from '@/lib/db/prisma'
import { getWhatsAppRecipient, sendWhatsAppText } from '@/lib/channels/whatsappSend'

export async function sendWhatsAppNotification(params: {
  tenantId: string
  text: string
}): Promise<void> {
  const conn = await prisma.channelConnection.findFirst({
    where: { tenantId: params.tenantId, channel: 'whatsapp', enabled: true },
  })
  const to = getWhatsAppRecipient((conn?.config as Record<string, unknown>) ?? {})
  if (!to) return

  await sendWhatsAppText(to, params.text)
}
