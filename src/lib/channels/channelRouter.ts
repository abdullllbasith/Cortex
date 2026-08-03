import { createHmac, timingSafeEqual } from 'crypto'
import type { ChannelResponse, ChannelType, StandardMessage } from './types'
import { runConversationEngine } from '@/lib/assistant/conversationEngine'
import {
  createSession,
  getContextWindow,
  saveMessage,
} from '@/lib/assistant/conversationMemory'
import { MessageRole, ConversationIntent } from '@prisma/client'
import { sendMail, isEmailConfigured } from '@/lib/email/mailTransport'

export function normalizeIncomingMessage(
  channel: ChannelType,
  rawPayload: Record<string, unknown>,
): StandardMessage | null {
  switch (channel) {
    case 'whatsapp':
      return normalizeWhatsApp(rawPayload)
    case 'slack':
      return normalizeSlack(rawPayload)
    case 'email':
      return normalizeEmail(rawPayload)
    default:
      return null
  }
}

function normalizeWhatsApp(payload: Record<string, unknown>): StandardMessage | null {
  const entry = (payload.entry as Array<Record<string, unknown>>)?.[0]
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
  const value = change?.value as Record<string, unknown> | undefined
  const messages = value?.messages as Array<Record<string, unknown>> | undefined
  const contacts = value?.contacts as Array<Record<string, unknown>> | undefined
  const metadata = value?.metadata as Record<string, unknown> | undefined

  const msg = messages?.[0]
  if (!msg) return null

  const phoneNumberId = metadata?.phone_number_id as string
  const from = msg.from as string
  const type = msg.type as string
  const tenantId = (payload.tenantId as string) ?? phoneNumberId

  let text = ''
  const attachments: StandardMessage['attachments'] = []

  if (type === 'text') {
    text = (msg.text as Record<string, string>)?.body ?? ''
  } else if (type === 'image') {
    const image = msg.image as Record<string, string>
    attachments.push({ type: 'image', mimeType: image?.mime_type, name: image?.id })
    text = '[Image received]'
  } else if (type === 'document') {
    const doc = msg.document as Record<string, string>
    attachments.push({ type: 'document', mimeType: doc?.mime_type, name: doc?.filename ?? doc?.id })
    text = `[Document: ${doc?.filename ?? 'attachment'}]`
  } else if (type === 'audio') {
    const audio = msg.audio as Record<string, string>
    attachments.push({ type: 'audio', mimeType: audio?.mime_type, name: audio?.id })
    text = '[Voice message received]'
  }

  const contactName = (contacts?.[0]?.profile as Record<string, string>)?.name

  return {
    channel: 'whatsapp',
    tenantId,
    userId: `wa:${from}`,
    externalId: msg.id as string,
    text,
    attachments,
    metadata: { phoneNumberId, contactName, rawType: type },
    timestamp: new Date(parseInt(msg.timestamp as string, 10) * 1000),
  }
}

function normalizeSlack(payload: Record<string, unknown>): StandardMessage | null {
  const event = payload.event as Record<string, unknown> | undefined
  if (!event) return null

  const type = event.type as string
  if (type !== 'app_mention' && type !== 'message') return null
  if (event.subtype || event.bot_id) return null

  const text = (event.text as string)?.replace(/<@[A-Z0-9]+>/g, '').trim() ?? ''
  const tenantId = (payload.tenantId as string) ?? (payload.team_id as string)
  const userId = `slack:${event.user as string}`

  return {
    channel: 'slack',
    tenantId,
    userId,
    externalId: (event.ts as string) ?? (event.client_msg_id as string),
    text,
    metadata: {
      channel: event.channel,
      teamId: payload.team_id,
      threadTs: event.thread_ts,
    },
    timestamp: new Date(parseFloat(event.ts as string) * 1000),
  }
}

function normalizeEmail(payload: Record<string, unknown>): StandardMessage | null {
  const from = payload.from as string
  const subject = (payload.subject as string) ?? ''
  const text = (payload.text as string) ?? (payload.html as string) ?? ''
  const tenantId = (payload.tenantId as string) ?? 'default'

  if (!from) return null

  return {
    channel: 'email',
    tenantId,
    userId: `email:${from}`,
    externalId: (payload.messageId as string) ?? `email-${Date.now()}`,
    text: `${subject}\n\n${text}`.trim(),
    subject,
    metadata: { from, to: payload.to, headers: payload.headers },
    timestamp: new Date(),
  }
}

export async function processChannelMessage(
  message: StandardMessage,
): Promise<ChannelResponse> {
  const session = await createSession(
    message.tenantId,
    message.userId,
    `${message.channel} conversation`,
    message.channel,
  )

  await saveMessage({
    sessionId: session.id,
    tenantId: message.tenantId,
    role: MessageRole.USER,
    content: message.text,
    metadata: { channel: message.channel, externalId: message.externalId },
  })

  const { recentTurns, summary } = await getContextWindow(message.tenantId, session.id)

  const result = await runConversationEngine({
    tenantId: message.tenantId,
    userId: message.userId,
    userMessage: message.text,
    conversationHistory: recentTurns.slice(0, -1),
    sessionId: session.id,
    permissions: ['*'],
  })

  await saveMessage({
    sessionId: session.id,
    tenantId: message.tenantId,
    role: MessageRole.ASSISTANT,
    content: result.assistantMessage,
    intent: result.intent?.intent as ConversationIntent | undefined,
    confidence: result.intent?.confidence,
    sourcesUsed: result.sourcesUsed,
    actionsTaken: result.actionsTaken,
    suggestedFollowUps: result.suggestedFollowUps,
    metadata: { channel: message.channel, summary },
  })

  return formatChannelResponse(message.channel, result.assistantMessage, result.suggestedFollowUps)
}

export async function sendResponse(
  channel: ChannelType,
  tenantId: string,
  userId: string,
  response: ChannelResponse,
): Promise<void> {
  switch (channel) {
    case 'whatsapp':
      await sendWhatsAppResponse(tenantId, userId, response)
      break
    case 'slack':
      await sendSlackResponse(tenantId, userId, response)
      break
    case 'email':
      await sendEmailResponse(tenantId, userId, response)
      break
    default:
      break
  }
}

function formatChannelResponse(
  channel: ChannelType,
  text: string,
  followUps: string[],
): ChannelResponse {
  if (channel === 'slack') {
    return {
      text,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text } },
        ...(followUps.length
          ? [{
              type: 'context',
              elements: followUps.map((f) => ({ type: 'mrkdwn', text: `• ${f}` })),
            }]
          : []),
      ],
    }
  }

  if (channel === 'email') {
    const html = `
      <div style="font-family: sans-serif; max-width: 640px;">
        <div style="border-left: 4px solid #4f46e5; padding-left: 16px;">
          ${text.replace(/\n/g, '<br>')}
        </div>
        ${followUps.length ? `<p style="color:#64748b;margin-top:24px;"><strong>Suggested follow-ups:</strong><br>${followUps.map((f) => `• ${f}`).join('<br>')}</p>` : ''}
        <p style="color:#94a3b8;font-size:12px;margin-top:32px;">Powered by Cortex Executive Assistant</p>
      </div>`
    return { text, html }
  }

  return { text }
}

async function sendWhatsAppResponse(
  tenantId: string,
  userId: string,
  response: ChannelResponse,
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.warn('[whatsapp] Missing credentials, skipping send')
    return
  }

  const to = userId.replace(/^wa:/, '')

  if (response.templateName) {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: response.templateName,
          language: { code: 'en' },
          components: response.templateParams
            ? [{ type: 'body', parameters: Object.values(response.templateParams).map((t) => ({ type: 'text', text: t })) }]
            : [],
        },
      }),
    })
    return
  }

  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: response.text.slice(0, 4096) },
    }),
  })

  void tenantId
}

async function sendSlackResponse(
  tenantId: string,
  userId: string,
  response: ChannelResponse,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[slack] Missing SLACK_BOT_TOKEN, skipping send')
    return
  }

  const channel = (response.metadata?.channel as string) ?? userId.replace(/^slack:/, '')

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text: response.text,
      blocks: response.blocks,
    }),
  })

  void tenantId
}

async function sendEmailResponse(
  tenantId: string,
  userId: string,
  response: ChannelResponse,
): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[email] Email transport not configured, skipping send')
    return
  }

  const to = userId.replace(/^email:/, '')

  await sendMail({
    to,
    subject: 'Re: Your inquiry to Cortex',
    text: response.text,
    html: response.html,
    fromName: 'Cortex Assistant',
  })

  void tenantId
}

export function verifyWhatsAppSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !signature) return process.env.AUTH_DEV_MODE === 'true'

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const sig = signature.replace(/^sha256=/, '')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

export function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret || !timestamp || !signature) return process.env.AUTH_DEV_MODE === 'true'

  const base = `v0:${timestamp}:${rawBody}`
  const expected = 'v0=' + createHmac('sha256', secret).update(base).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function sendProactiveWhatsAppTemplate(
  to: string,
  templateName: string,
  params: Record<string, string>,
): Promise<void> {
  await sendWhatsAppResponse('system', `wa:${to}`, {
    text: '',
    templateName,
    templateParams: params,
  })
}
