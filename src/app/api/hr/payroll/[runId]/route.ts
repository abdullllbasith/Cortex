import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getPayrollRun } from '@/lib/hr/payrollService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { runId } = await params
    const record = await getPayrollRun(auth.tenantId, runId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
