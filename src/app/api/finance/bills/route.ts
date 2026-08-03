import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { billCreateSchema, billListQuerySchema } from '@/lib/finance/financeSchemas'
import { createBill, listBills } from '@/lib/finance/billService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = billListQuerySchema.parse(parseQuery(request))
    const result = await listBills(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = billCreateSchema.parse(await request.json())
    const record = await createBill(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
