import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeIncomingMessage,
  processChannelMessage,
  sendResponse,
} from '@/lib/channels/channelRouter'
import { apiError } from '@/lib/knowledge/response'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const from = (formData.get('from') as string) ?? ''
    const subject = (formData.get('subject') as string) ?? ''
    const text = (formData.get('text') as string) ?? ''
    const html = (formData.get('html') as string) ?? ''
    const to = (formData.get('to') as string) ?? ''

    const tenantId =
      request.headers.get('x-tenant-id') ??
      to.split('@')[0] ??
      'default'

    const payload: Record<string, unknown> = {
      from,
      subject,
      text: text || stripHtml(html),
      html,
      to,
      messageId: formData.get('message-id') ?? `email-${Date.now()}`,
      tenantId,
    }

    const message = normalizeIncomingMessage('email', payload)
    if (!message) {
      return apiError('Invalid email payload', 'VALIDATION_ERROR', 400)
    }

    const commandSubject = subject.replace(/^(re:\s*)+/i, '').trim()
    message.text = `[Subject: ${commandSubject}]\n\n${message.text}`

    const response = await processChannelMessage(message)
    await sendResponse('email', message.tenantId, message.userId, response)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[email/inbound]', err)
    return apiError('Email processing failed', 'WEBHOOK_ERROR', 500)
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
