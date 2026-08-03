import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { inventoryAnalyticsSchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    inventoryAnalyticsSchema.parse(parseQuery(request))
    const data = await analyticsRepository.getInventoryAnalytics(auth.tenantId)
    return NextResponse.json(apiSuccess(data), { headers: analyticsCacheHeaders(30, 120) })
  } catch (err) {
    return handleRouteError(err)
  }
})
