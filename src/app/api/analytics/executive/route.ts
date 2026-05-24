import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { customerAnalyticsSchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'
import { completeWithClaude, isAssistantLlmAvailable } from '@/lib/assistant/claudeClient'
import { mapToDashboardData } from '@/lib/analytics/dashboardMapper'
import type { ExecutiveAnalyticsData } from '@/lib/analytics/types'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = customerAnalyticsSchema.parse(parseQuery(request))
    const data = await analyticsRepository.getExecutiveAnalytics(
      auth.tenantId,
      query.period,
      query.startDate,
      query.endDate,
    ) as ExecutiveAnalyticsData

    let insightSummary = ''
    if (isAssistantLlmAvailable()) {
      try {
        insightSummary = await completeWithClaude({
          systemPrompt: 'You are a business analyst. Write exactly 2-3 concise sentences summarizing key business performance insights. Be specific with numbers when provided.',
          messages: [{
            role: 'user',
            content: `Summarize this executive dashboard data:\n${JSON.stringify({
              scorecard: data.scorecard,
              period: data.period,
            }).slice(0, 3000)}`,
          }],
          maxTokens: 256,
        })
      } catch {
        insightSummary = generateFallbackInsight(data)
      }
    } else {
      insightSummary = generateFallbackInsight(data)
    }

    const withInsight = {
      ...data,
      insight: { summary: insightSummary, generatedAt: new Date().toISOString() },
    }

    const format = request.nextUrl.searchParams.get('format') ?? 'dashboard'
    if (format === 'analytics') {
      return NextResponse.json(apiSuccess(withInsight), { headers: analyticsCacheHeaders(60, 300) })
    }

    const dashboard = await mapToDashboardData(withInsight, auth.tenantId)

    return NextResponse.json(apiSuccess(dashboard), { headers: analyticsCacheHeaders(60, 300) })
  } catch (err) {
    return handleRouteError(err)
  }
})

function generateFallbackInsight(data: ExecutiveAnalyticsData): string {
  const rev = data.modules.sales.totalRevenue
  const change = data.scorecard.find((s) => s.metric === 'Revenue')?.change ?? 0
  return `Revenue for ${data.period} totals $${Math.round(rev).toLocaleString()}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% vs the prior period. ${data.modules.inventory.reorderRequired.length} products need reorder attention. Supplier on-time delivery is at ${data.modules.suppliers.onTimeDeliveryRate}%.`
}
