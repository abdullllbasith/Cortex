import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { dealUpdateSchema } from '@/lib/crm/crmSchemas'
import { lostDeal, moveDeal, updateDeal, wonDeal } from '@/lib/crm/pipelineService'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const dealActionSchema = dealUpdateSchema.extend({
  action: z.enum(['move', 'won', 'lost']).optional(),
})

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const deal = await prisma.crmDeal.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, avatarUrl: true } },
        pipeline: { select: { id: true, name: true, stages: true } },
      },
    })
    if (!deal) {
      return NextResponse.json({ error: { message: 'Deal not found' } }, { status: 404 })
    }
    return NextResponse.json(apiSuccess(deal))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = dealActionSchema.parse(await request.json())

    if (body.action === 'move' && body.stageId) {
      const record = await moveDeal(id, body.stageId, auth.tenantId, auth.userId)
      return NextResponse.json(apiSuccess(record))
    }
    if (body.action === 'won') {
      const actualValue = body.value != null ? Number(body.value) : undefined
      const record = await wonDeal(id, auth.tenantId, actualValue, auth.userId)
      return NextResponse.json(apiSuccess(record))
    }
    if (body.action === 'lost') {
      const record = await lostDeal(id, auth.tenantId, body.lostReason ?? 'No reason provided', auth.userId)
      return NextResponse.json(apiSuccess(record))
    }

    const record = await updateDeal(auth.tenantId, id, body)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
