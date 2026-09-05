import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import {
  getWhatsAppRecipient,
  markWhatsAppActivity,
  sendWhatsAppTestMessage,
} from '@/lib/channels/whatsappSend'

const bodySchema = z.object({
  channel: z.enum(['whatsapp', 'slack', 'email']),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = bodySchema.parse(await request.json())

    const conn = await prisma.channelConnection.findUnique({
      where: { tenantId_channel: { tenantId: auth.tenantId, channel: body.channel } },
    })

    if (!conn?.enabled) {
      return NextResponse.json(
        { success: false, error: { message: 'Channel is not connected' } },
        { status: 400 },
      )
    }

    if (body.channel === 'whatsapp') {
      const config = (conn.config as Record<string, unknown>) ?? {}
      const to = getWhatsAppRecipient(config)
      if (!to) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'No WhatsApp phone number saved. Disconnect and reconnect with your business number.',
            },
          },
          { status: 400 },
        )
      }

      const result = await sendWhatsAppTestMessage(to)
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: { message: result.error } },
          { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
        )
      }

      await markWhatsAppActivity(auth.tenantId, { to, phone: to, accountName: config.accountName ?? to })

      return NextResponse.json(
        apiSuccess({
          channel: 'whatsapp',
          to,
          messageId: result.messageId,
          sent: true,
        }),
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: { message: `Test send for ${body.channel} is not implemented yet` },
      },
      { status: 501 },
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
