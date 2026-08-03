import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'
import { buildInviteEmailPreview } from '@/lib/settings/roleDefinitions'
import { ROLE_LABELS } from '@/lib/settings/roleDefinitions'
import type { UserRole } from '@prisma/client'

export async function sendTeamInviteEmail(opts: {
  to: string
  tenantName: string
  inviterName: string
  role: UserRole
  token: string
  message?: string | null
  appUrl: string
}) {
  const inviteUrl = `${opts.appUrl.replace(/\/$/, '')}/invite/${opts.token}`
  const roleLabel = ROLE_LABELS[opts.role]
  const text = buildInviteEmailPreview({
    tenantName: opts.tenantName,
    inviterName: opts.inviterName,
    roleLabel,
    customMessage: opts.message ?? undefined,
    inviteUrl,
  })

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="font-size:20px;margin-bottom:8px">Join ${opts.tenantName} on Cortex</h2>
      <p style="color:#475569;line-height:1.6">${opts.message?.trim() || "You've been invited to join our workspace on Cortex."}</p>
      <p style="color:#475569"><strong>Role:</strong> ${roleLabel}<br/><strong>Invited by:</strong> ${opts.inviterName}</p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8">This link expires in 48 hours.</p>
    </div>
  `

  if (!isEmailConfigured()) {
    console.info('[team-invite-email]', opts.to, inviteUrl)
    return { sent: false, inviteUrl }
  }

  await sendMail({
    to: opts.to,
    subject: `Join ${opts.tenantName} on Cortex`,
    text,
    html,
  })

  return { sent: true, inviteUrl }
}
