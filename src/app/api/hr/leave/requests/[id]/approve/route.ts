import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { approveLeave } from '@/lib/hr/leaveService'
import { getEmployeeByUserId } from '@/lib/hr/employeeService'

export const POST = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const approver = await getEmployeeByUserId(auth.tenantId, auth.userId)
    if (!approver) throw new Error('Approver must have an employee profile')
    const result = await approveLeave(id, auth.tenantId, approver.id)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
