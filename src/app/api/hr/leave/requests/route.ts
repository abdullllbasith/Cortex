import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { leaveApplySchema, leaveRequestListSchema } from '@/lib/hr/hrSchemas'
import { applyLeave, listLeaveRequests } from '@/lib/hr/leaveService'
import { getEmployeeByUserId } from '@/lib/hr/employeeService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = leaveRequestListSchema.parse(parseQuery(request))
    const result = await listLeaveRequests(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = leaveApplySchema.parse(await request.json())
    let employeeId = body.employeeId
    if (!employeeId) {
      const self = await getEmployeeByUserId(auth.tenantId, auth.userId)
      if (!self) throw new Error('No employee profile linked to your account')
      employeeId = self.id
    }
    const record = await applyLeave(auth.tenantId, employeeId, body)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
