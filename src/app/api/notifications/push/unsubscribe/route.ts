import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const schema = z.object({ endpoint: z.string().url() })

export const DELETE = withTenantAuth(async (request, { auth }) => {
  try {
    const body = schema.parse(await request.json())
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, tenantId: auth.tenantId, userId: auth.userId },
    })
    return NextResponse.json(apiSuccess({ unsubscribed: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})
