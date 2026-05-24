import { sendMail } from '@/lib/email/mailTransport'

export async function sendSupplierEmail(params: {
  to: string
  subject: string
  body: string
  pdfBuffer?: Buffer
  pdfFilename?: string
}): Promise<void> {
  await sendMail({
    to: params.to,
    subject: params.subject,
    text: params.body,
    fromName: process.env.SMTP_FROM_NAME ?? process.env.SENDGRID_FROM_NAME ?? 'SAIOS Procurement',
    attachments:
      params.pdfBuffer && params.pdfFilename
        ? [
            {
              filename: params.pdfFilename,
              content: params.pdfBuffer,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
  })
}

export function extractSupplierEmail(supplierInfo: unknown): string | null {
  if (!supplierInfo || typeof supplierInfo !== 'object') return null
  const info = supplierInfo as Record<string, unknown>
  const email = info.email ?? info.contactEmail ?? info.primaryEmail
  return typeof email === 'string' && email.includes('@') ? email : null
}

export function extractSupplierAddress(supplierInfo: unknown): string | null {
  if (!supplierInfo || typeof supplierInfo !== 'object') return null
  const info = supplierInfo as Record<string, unknown>
  const parts = [info.address, info.city, info.state, info.country, info.postalCode].filter(
    (p) => typeof p === 'string' && p.length > 0,
  ) as string[]
  return parts.length ? parts.join(', ') : null
}

export function formatWarehouseAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null
  const a = address as Record<string, unknown>
  const parts = [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(
    (p) => typeof p === 'string' && p.length > 0,
  ) as string[]
  return parts.length ? parts.join(', ') : null
}
