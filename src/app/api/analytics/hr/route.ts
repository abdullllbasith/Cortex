import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { customerAnalyticsSchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'
import { getHrModuleSummary } from '@/lib/analytics/moduleSummaryService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = customerAnalyticsSchema.parse(parseQuery(request))
    const summary = await getHrModuleSummary(auth.tenantId)
    const details =
      request.nextUrl.searchParams.get('details') === 'true'
        ? await analyticsRepository.getHrAnalytics(
            auth.tenantId,
            query.period,
            query.startDate,
            query.endDate,
          )
        : undefined

    return NextResponse.json(
      apiSuccess({ ...summary, period: query.period, ...(details ? { details } : {}) }),
      { headers: analyticsCacheHeaders(60, 300) },
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
