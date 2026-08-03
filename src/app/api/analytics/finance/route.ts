import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { analyticsQuerySchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'
import { getFinanceModuleSummary } from '@/lib/analytics/moduleSummaryService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = analyticsQuerySchema.parse(parseQuery(request))
    const summary = await getFinanceModuleSummary(auth.tenantId)
    const details =
      request.nextUrl.searchParams.get('details') === 'true'
        ? await analyticsRepository.getFinanceAnalytics(
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
