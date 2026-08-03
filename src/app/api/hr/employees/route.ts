import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { employeeCreateSchema, employeeListQuerySchema } from '@/lib/hr/hrSchemas'
import { createEmployee, listEmployees } from '@/lib/hr/employeeService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = employeeListQuerySchema.parse(parseQuery(request))
    const result = await listEmployees(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = employeeCreateSchema.parse(await request.json())
    const record = await createEmployee(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
