import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeIncomingMessage,
  processChannelMessage,
  sendResponse,
  verifySlackSignature,
} from '@/lib/channels/channelRouter'
import { apiError } from '@/lib/knowledge/response'

export const runtime = 'nodejs'

async function handleSlashCommand(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()
  const command = formData.get('command') as string
  const text = (formData.get('text') as string) ?? ''
  const userId = formData.get('user_id') as string
  const teamId = formData.get('team_id') as string
  const channelId = formData.get('channel_id') as string

  const tenantId = request.headers.get('x-tenant-id') ?? teamId

  let queryText = text
  if (command === '/saios-report') {
    queryText = `Generate a business report: ${text || 'executive summary for this week'}`
  } else if (command === '/saios-query') {
    queryText = text || 'What can you help me with?'
  }

  const message = {
    channel: 'slack' as const,
    tenantId,
    userId: `slack:${userId}`,
    externalId: `cmd-${Date.now()}`,
    text: queryText,
    metadata: { channel: channelId, teamId },
    timestamp: new Date(),
  }

  const response = await processChannelMessage(message)
  response.metadata = { ...response.metadata, channel: channelId }

  return NextResponse.json({
    response_type: 'in_channel',
    text: response.text,
    blocks: response.blocks,
  })
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const clone = request.clone()
      const rawBody = await clone.text()
      const signature = request.headers.get('x-slack-signature')
      const timestamp = request.headers.get('x-slack-request-timestamp')

      if (!verifySlackSignature(rawBody, timestamp, signature)) {
        return apiError('Invalid Slack signature', 'INVALID_SIGNATURE', 401)
      }

      const params = new URLSearchParams(rawBody)
      if (params.get('command')) {
        return handleSlashCommand(request)
      }
    }

    const rawBody = await request.text()
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    if (!verifySlackSignature(rawBody, timestamp, signature)) {
      return apiError('Invalid Slack signature', 'INVALID_SIGNATURE', 401)
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>

    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge })
    }

    const tenantId = request.headers.get('x-tenant-id') ?? undefined
    if (tenantId) payload.tenantId = tenantId

    const message = normalizeIncomingMessage('slack', payload)
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const response = await processChannelMessage(message)
    response.metadata = {
      ...response.metadata,
      channel: message.metadata?.channel,
    }
    await sendResponse('slack', message.tenantId, message.userId, response)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[slack/events]', err)
    return apiError('Slack event processing failed', 'WEBHOOK_ERROR', 500)
  }
}
