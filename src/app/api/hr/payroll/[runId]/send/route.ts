import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { sendPaySlips } from '@/lib/hr/payrollService'

export const POST = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { runId } = await params
    const result = await sendPaySlips(runId, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
