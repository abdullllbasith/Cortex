import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getMasterDashboardData } from '@/lib/analytics/masterDashboardService'
import { analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getMasterDashboardData(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(data), { headers: analyticsCacheHeaders(30, 120) })
  } catch (err) {
    return handleRouteError(err)
  }
})
