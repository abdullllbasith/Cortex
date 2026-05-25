import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { convertToOrder } from '@/lib/sales/quoteService'

export const POST = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const order = await convertToOrder(id, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(order), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
