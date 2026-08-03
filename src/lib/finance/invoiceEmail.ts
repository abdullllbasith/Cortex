import { sendMail } from '@/lib/email/mailTransport'

export async function sendInvoiceEmail(params: {
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
    fromName: process.env.SMTP_FROM_NAME ?? process.env.SENDGRID_FROM_NAME ?? 'Cortex Finance',
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
