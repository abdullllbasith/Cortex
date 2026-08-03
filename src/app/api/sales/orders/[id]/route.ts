import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { orderUpdateSchema } from '@/lib/sales/salesSchemas'
import { getOrder, getOrderTimeline, updateOrder } from '@/lib/sales/orderService'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const url = new URL(request.url)
    if (url.searchParams.get('timeline') === 'true') {
      const timeline = await getOrderTimeline(id, auth.tenantId)
      return NextResponse.json(apiSuccess({ timeline }))
    }
    const record = await getOrder(auth.tenantId, id)
    if (!record) {
      return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
    }
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = orderUpdateSchema.parse(await request.json())
    const record = await updateOrder(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
