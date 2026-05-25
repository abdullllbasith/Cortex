import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { approvePayroll } from '@/lib/hr/payrollService'

export const POST = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { runId } = await params
    const record = await approvePayroll(runId, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
