import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getFinanceDashboard } from '@/lib/finance/reportingService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const dashboard = await getFinanceDashboard(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(dashboard))
  } catch (err) {
    return handleRouteError(err)
  }
})
