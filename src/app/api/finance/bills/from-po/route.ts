import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { createFromPO } from '@/lib/finance/billService'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const { purchaseOrderId } = (await request.json()) as { purchaseOrderId: string }
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required')
    const record = await createFromPO(purchaseOrderId, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
