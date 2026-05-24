import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { channelUpdateSchema } from '@/lib/assistant/schemas'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

const CHANNELS = ['whatsapp', 'slack', 'email'] as const

function getWebhookUrl(channel: string, request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  return `${base}/api/channels/${channel}/${channel === 'email' ? 'inbound' : channel === 'whatsapp' ? 'webhook' : 'events'}`
}

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const connections = await prisma.channelConnection.findMany({
      where: { tenantId: auth.tenantId },
    })

    const configMap = Object.fromEntries(connections.map((c) => [c.channel, c]))

    const data = CHANNELS.map((channel) => ({
      channel,
      enabled: configMap[channel]?.enabled ?? false,
      config: (configMap[channel]?.config as Record<string, unknown>) ?? {},
      webhookUrl: getWebhookUrl(channel, request),
    }))

    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = channelUpdateSchema.parse(await request.json())

    const record = await prisma.channelConnection.upsert({
      where: {
        tenantId_channel: { tenantId: auth.tenantId, channel: body.channel },
      },
      create: {
        tenantId: auth.tenantId,
        channel: body.channel,
        enabled: body.enabled,
        config: (body.config ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        enabled: body.enabled,
        config: (body.config ?? {}) as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
