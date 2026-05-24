import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { analyticsQuerySchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = analyticsQuerySchema.parse(parseQuery(request))
    const data = await analyticsRepository.getSalesAnalytics(auth.tenantId, query)
    return NextResponse.json(apiSuccess(data), { headers: analyticsCacheHeaders() })
  } catch (err) {
    return handleRouteError(err)
  }
})
