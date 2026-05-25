import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { cancelOrder } from '@/lib/sales/orderService'
import { z } from 'zod'

const cancelSchema = z.object({ reason: z.string().min(1) })

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = cancelSchema.parse(await request.json())
    const record = await cancelOrder(id, auth.tenantId, body.reason, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
