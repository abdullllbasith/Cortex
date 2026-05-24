import nodemailer from 'nodemailer'

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export interface SendMailParams {
  to: string | { email: string; name?: string }
  subject: string
  text?: string
  html?: string
  fromEmail?: string
  fromName?: string
  attachments?: MailAttachment[]
}

function resolveRecipient(to: SendMailParams['to']): { address: string; name?: string } {
  if (typeof to === 'string') return { address: to }
  return { address: to.email, name: to.name }
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function sendgridConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY)
}

export function isEmailConfigured(): boolean {
  return smtpConfigured() || sendgridConfigured()
}

export function getDefaultFrom(): { email: string; name: string } {
  return {
    email:
      process.env.SMTP_FROM_EMAIL ??
      process.env.SMTP_USER ??
      process.env.SENDGRID_FROM_EMAIL ??
      'notifications@saios.app',
    name: process.env.SMTP_FROM_NAME ?? process.env.SENDGRID_FROM_NAME ?? 'SAIOS',
  }
}

async function sendViaSmtp(params: SendMailParams): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  const from = getDefaultFrom()
  const recipient = resolveRecipient(params.to)

  await transporter.sendMail({
    from: {
      name: params.fromName ?? from.name,
      address: params.fromEmail ?? from.email,
    },
    to: recipient.name ? `${recipient.name} <${recipient.address}>` : recipient.address,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments?.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  })
}

async function sendViaSendGrid(params: SendMailParams): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured')

  const from = getDefaultFrom()
  const recipient = resolveRecipient(params.to)

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: recipient.address, ...(recipient.name ? { name: recipient.name } : {}) }],
      },
    ],
    from: {
      email: params.fromEmail ?? from.email,
      name: params.fromName ?? from.name,
    },
    subject: params.subject,
    content: [
      ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
      ...(params.html ? [{ type: 'text/html', value: params.html }] : []),
    ],
  }

  if (!params.text && !params.html) {
    payload.content = [{ type: 'text/plain', value: params.subject }]
  }

  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((file) => ({
      content: file.content.toString('base64'),
      filename: file.filename,
      type: file.contentType ?? 'application/octet-stream',
      disposition: 'attachment',
    }))
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SendGrid email failed (${res.status}): ${text}`)
  }
}

/** Sends email via SMTP (Gmail, etc.) when configured, otherwise SendGrid. */
export async function sendMail(params: SendMailParams): Promise<void> {
  if (smtpConfigured()) {
    await sendViaSmtp(params)
    return
  }

  if (sendgridConfigured()) {
    await sendViaSendGrid(params)
    return
  }

  throw new Error(
    'Email is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS for Gmail, or SENDGRID_API_KEY.',
  )
}
