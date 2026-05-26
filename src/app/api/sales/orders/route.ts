import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { orderCreateSchema, orderListQuerySchema } from '@/lib/sales/salesSchemas'
import { getOrderDashboard } from '@/lib/sales/orderDashboardService'
import { createOrder, listOrders } from '@/lib/sales/orderService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('stats') === 'true') {
      const kpis = await getOrderDashboard(auth.tenantId)
      return NextResponse.json(apiSuccess(kpis))
    }
    const query = orderListQuerySchema.parse(parseQuery(request))
    const result = await listOrders(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = orderCreateSchema.parse(await request.json())
    const record = await createOrder(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
