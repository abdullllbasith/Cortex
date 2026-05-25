import { prisma } from '@/lib/db/prisma'
import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'
import { resolveAppUrl } from '@/lib/utils'

export async function sendEmailNotification(params: {
  tenantId: string
  userId: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  if (!isEmailConfigured()) return

  const user = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId },
    select: { email: true, fullName: true },
  })
  if (!user?.email) return

  await sendMail({
    to: { email: user.email, name: user.fullName },
    subject: params.subject,
    text: params.text,
    html: params.html,
  })
}

export function formatEmailHtml(title: string, body: string, actionUrl?: string, actionLabel?: string): string {
  const href = resolveAppUrl(actionUrl)
  const cta = href
    ? `<p style="margin-top:16px"><a href="${href}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${actionLabel ?? 'Open in SAIOS'}</a></p>`
    : ''
  return `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;color:#0f172a"><h2>${title}</h2><p>${body}</p>${cta}</body></html>`
}
