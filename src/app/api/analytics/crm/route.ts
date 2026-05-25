import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { analyticsQuerySchema } from '@/lib/analytics/schemas'
import { getCrmModuleSummary } from '@/lib/analytics/moduleSummaryService'
import { getCrmAnalytics } from '@/lib/crm/crmAnalyticsService'
import { analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = analyticsQuerySchema.parse(parseQuery(request))
    const summary = await getCrmModuleSummary(auth.tenantId)
    const details =
      request.nextUrl.searchParams.get('details') === 'true'
        ? await getCrmAnalytics(auth.tenantId)
        : undefined

    return NextResponse.json(
      apiSuccess({ ...summary, period: query.period, ...(details ? { details } : {}) }),
      { headers: analyticsCacheHeaders(60, 300) },
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
