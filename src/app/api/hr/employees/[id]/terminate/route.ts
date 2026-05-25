import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { employeeTerminateSchema } from '@/lib/hr/hrSchemas'
import { terminateEmployee } from '@/lib/hr/employeeService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = employeeTerminateSchema.parse(await request.json())
    const record = await terminateEmployee(id, auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
