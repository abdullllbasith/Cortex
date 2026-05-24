import { prisma } from '@/lib/db/prisma'

export async function sendSlackNotification(params: {
  tenantId: string
  text: string
}): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return

  const conn = await prisma.channelConnection.findFirst({
    where: { tenantId: params.tenantId, channel: 'slack', enabled: true },
  })
  const config = (conn?.config ?? {}) as { channel?: string; userId?: string }
  const channel = config.channel ?? config.userId?.replace(/^slack:/, '') ?? '#general'

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text: params.text }),
  })
}
