import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { createFromOrder } from '@/lib/finance/invoiceService'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const { orderId } = (await request.json()) as { orderId: string }
    if (!orderId) throw new Error('orderId is required')
    const record = await createFromOrder(orderId, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
