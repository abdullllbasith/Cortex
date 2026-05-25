import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { payrollRunCreateSchema, payrollRunListSchema } from '@/lib/hr/hrSchemas'
import { estimatePayroll, listPayrollRuns, runPayroll } from '@/lib/hr/payrollService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = payrollRunListSchema.parse(parseQuery(request))
    const estimate = request.nextUrl.searchParams.get('estimate')
    if (estimate === 'true') {
      const month = parseInt(request.nextUrl.searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)
      const year = parseInt(request.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()), 10)
      const result = await estimatePayroll(auth.tenantId, month, year)
      return NextResponse.json(apiSuccess(result))
    }
    const result = await listPayrollRuns(auth.tenantId, query.page, query.limit)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = payrollRunCreateSchema.parse(await request.json())
    const record = await runPayroll(auth.tenantId, body.month, body.year, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
