import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { pushSubscribeSchema } from '@/lib/notifications/schemas'
import { prisma } from '@/lib/db/prisma'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = pushSubscribeSchema.parse(await request.json())
    const ua = body.userAgent ?? request.headers.get('user-agent') ?? undefined

    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: ua,
      },
      update: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: ua,
      },
    })

    return NextResponse.json(apiSuccess({ subscribed: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})
