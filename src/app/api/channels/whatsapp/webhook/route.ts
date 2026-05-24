import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeIncomingMessage,
  processChannelMessage,
  sendResponse,
  verifyWhatsAppSignature,
} from '@/lib/channels/channelRouter'
import { apiError } from '@/lib/knowledge/response'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return apiError('Forbidden', 'FORBIDDEN', 403)
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifyWhatsAppSignature(rawBody, signature)) {
      return apiError('Invalid signature', 'INVALID_SIGNATURE', 401)
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const tenantId = request.headers.get('x-tenant-id') ?? undefined
    if (tenantId) payload.tenantId = tenantId

    const message = normalizeIncomingMessage('whatsapp', payload)
    if (!message) {
      return NextResponse.json({ success: true })
    }

    const response = await processChannelMessage(message)
    await sendResponse('whatsapp', message.tenantId, message.userId, response)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/webhook]', err)
    return apiError('Webhook processing failed', 'WEBHOOK_ERROR', 500)
  }
}
