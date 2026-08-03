import { prisma } from '@/lib/db/prisma'
import type { NotificationDigestFrequency } from '@prisma/client'
import { formatEmailHtml, sendEmailNotification } from './emailChannel'

export async function queueForDigest(params: {
  tenantId: string
  userId: string
  digestType: NotificationDigestFrequency
  notification: { title: string; body: string; createdAt: string }
}): Promise<void> {
  if (params.digestType === 'IMMEDIATE') return

  const now = new Date()
  const periodStart = new Date(now)
  periodStart.setMinutes(0, 0, 0)

  const existing = await prisma.notificationDigest.findFirst({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      digestType: params.digestType,
      sentAt: null,
      periodEnd: { gte: now },
    },
    orderBy: { periodEnd: 'desc' },
  })

  const list = existing
    ? ([...(existing.notifications as unknown[]), params.notification] as unknown[])
    : [params.notification]

  if (existing) {
    await prisma.notificationDigest.update({
      where: { id: existing.id },
      data: { notifications: list as never },
    })
    return
  }

  const periodEnd = new Date(periodStart)
  if (params.digestType === 'HOURLY') periodEnd.setHours(periodEnd.getHours() + 1)
  else if (params.digestType === 'DAILY') periodEnd.setDate(periodEnd.getDate() + 1)
  else periodEnd.setDate(periodEnd.getDate() + 7)

  await prisma.notificationDigest.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      digestType: params.digestType,
      notifications: list as never,
      periodStart,
      periodEnd,
    },
  })
}

export async function flushDueDigests(): Promise<number> {
  const due = await prisma.notificationDigest.findMany({
    where: { sentAt: null, periodEnd: { lte: new Date() } },
    take: 50,
  })

  let sent = 0
  for (const digest of due) {
    const items = (digest.notifications as Array<{ title: string; body: string }>) ?? []
    if (items.length === 0) {
      await prisma.notificationDigest.update({
        where: { id: digest.id },
        data: { sentAt: new Date() },
      })
      continue
    }

    const subject = `Cortex digest — ${items.length} notification${items.length === 1 ? '' : 's'}`
    const htmlItems = items.map((i) => `<li><strong>${i.title}</strong><br/>${i.body}</li>`).join('')
    const html = formatEmailHtml(subject, `<ul>${htmlItems}</ul>`)
    const text = items.map((i) => `- ${i.title}: ${i.body}`).join('\n')

    await sendEmailNotification({
      tenantId: digest.tenantId,
      userId: digest.userId,
      subject,
      html,
      text,
    })

    await prisma.notificationDigest.update({
      where: { id: digest.id },
      data: { sentAt: new Date() },
    })
    sent++
  }
  return sent
}
