import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { fulfillmentSchema } from '@/lib/sales/salesSchemas'
import { fulfillOrder } from '@/lib/sales/orderService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = fulfillmentSchema.parse(await request.json())
    const record = await fulfillOrder(id, auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
