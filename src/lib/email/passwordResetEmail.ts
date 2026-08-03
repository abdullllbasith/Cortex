import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'

export async function sendPasswordResetEmail(opts: {
  to: string
  resetUrl: string
  userName?: string
}) {
  const greeting = opts.userName ? `Hi ${opts.userName},` : 'Hi,'
  const text = `${greeting}

We received a request to reset your Cortex password.

Reset your password using this link (expires in 1 hour):
${opts.resetUrl}

If you did not request this, you can ignore this email.

— Cortex`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="font-size:20px;margin-bottom:8px">Reset your password</h2>
      <p style="color:#475569;line-height:1.6">${greeting}</p>
      <p style="color:#475569;line-height:1.6">We received a request to reset your Cortex account password. Click the button below to choose a new password. This link expires in about one hour.</p>
      <p style="margin:24px 0">
        <a href="${opts.resetUrl}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `

  if (!isEmailConfigured()) {
    console.info('[password-reset-email]', opts.to, opts.resetUrl)
    return { sent: false, resetUrl: opts.resetUrl }
  }

  await sendMail({
    to: opts.to,
    subject: 'Reset your Cortex password',
    text,
    html,
    fromName: process.env.SMTP_FROM_NAME ?? 'Cortex',
  })

  return { sent: true, resetUrl: opts.resetUrl }
}
