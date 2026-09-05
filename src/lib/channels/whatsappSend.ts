import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; status: number; error: string }

function resolveAccess(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId }
}

export function normalizeWhatsAppTo(raw: string): string {
  return raw.replace(/^wa:/, '').replace(/[^\d+]/g, '').replace(/^\+/, '')
}

export function getWhatsAppRecipient(
  config: Record<string, unknown> | null | undefined,
): string | null {
  const raw =
    (config?.to as string | undefined) ||
    (config?.phone as string | undefined) ||
    (config?.accountName as string | undefined)
  if (!raw?.trim()) return null
  const to = normalizeWhatsAppTo(raw)
  return to || null
}

async function graphSend(
  body: Record<string, unknown>,
): Promise<WhatsAppSendResult> {
  const access = resolveAccess()
  if (!access) {
    return {
      ok: false,
      status: 503,
      error:
        'WhatsApp is not configured on the server. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
    }
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${access.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>
    error?: { message?: string; error_user_msg?: string }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        json.error?.error_user_msg ||
        json.error?.message ||
        `WhatsApp API error (${res.status})`,
    }
  }

  return { ok: true, messageId: json.messages?.[0]?.id }
}

/** Free-form text (only allowed inside the 24h customer-care window). */
export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  return graphSend({
    messaging_product: 'whatsapp',
    to: normalizeWhatsAppTo(to),
    type: 'text',
    text: { body: text.slice(0, 4096) },
  })
}

/** Meta’s default template — works outside the 24h window for connectivity tests. */
export async function sendWhatsAppHelloWorldTemplate(to: string): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate(to, 'hello_world', 'en_US')
}

export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  languageCode = 'en',
  bodyParams?: string[],
): Promise<WhatsAppSendResult> {
  return graphSend({
    messaging_product: 'whatsapp',
    to: normalizeWhatsAppTo(to),
    type: 'template',
    template: {
      name,
      language: { code: languageCode },
      components: bodyParams?.length
        ? [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({ type: 'text', text })),
            },
          ]
        : [],
    },
  })
}

export async function sendWhatsAppTestMessage(to: string): Promise<WhatsAppSendResult> {
  // Prefer the approved hello_world template so tests work without a prior inbound chat.
  const template = await sendWhatsAppHelloWorldTemplate(to)
  if (template.ok) return template

  // Fall back to plain text (works if the user already messaged the business number).
  const text = await sendWhatsAppText(
    to,
    'Cortex WhatsApp test: your channel is connected and working.',
  )
  if (text.ok) return text

  return {
    ok: false,
    status: template.status || text.status,
    error: `${template.error} Also tried text: ${text.error}`,
  }
}

export async function markWhatsAppActivity(
  tenantId: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  const existing = await prisma.channelConnection.findUnique({
    where: { tenantId_channel: { tenantId, channel: 'whatsapp' } },
  })
  if (!existing) return

  const config = {
    ...((existing.config as Record<string, unknown>) ?? {}),
    ...patch,
    lastMessageAt: new Date().toISOString(),
  }

  await prisma.channelConnection.update({
    where: { id: existing.id },
    data: { config: config as Prisma.InputJsonValue },
  })
}
