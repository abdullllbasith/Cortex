import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await analyticsRepository.getInventoryAnalytics(auth.tenantId)
    return NextResponse.json(apiSuccess(data), { headers: analyticsCacheHeaders(30, 120) })
  } catch (err) {
    return handleRouteError(err)
  }
})
