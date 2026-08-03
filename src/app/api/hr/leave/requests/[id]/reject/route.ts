import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { leaveRejectSchema } from '@/lib/hr/hrSchemas'
import { rejectLeave } from '@/lib/hr/leaveService'
import { getEmployeeByUserId } from '@/lib/hr/employeeService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = leaveRejectSchema.parse(await request.json())
    const approver = await getEmployeeByUserId(auth.tenantId, auth.userId)
    if (!approver) throw new Error('Approver must have an employee profile')
    const result = await rejectLeave(id, auth.tenantId, approver.id, body.reason)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
