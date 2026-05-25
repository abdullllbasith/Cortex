import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { customerAnalyticsSchema } from '@/lib/analytics/schemas'
import { analyticsRepository, analyticsCacheHeaders } from '@/lib/analytics/analyticsRepository'
import { ExecutiveAgent } from '@/lib/agents/ExecutiveAgent'
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
    try {
      const executive = new ExecutiveAgent(auth.tenantId, auth.userId)
      const health = await executive.getBusinessHealthSummary() as {
        narrative?: string
        risks?: string[]
        priorities?: string[]
      }
      insightSummary = health.narrative ?? ''
      if (health.risks?.length) {
        insightSummary += ` Key risks: ${health.risks.slice(0, 2).join('; ')}.`
      }
    } catch {
      insightSummary = generateFallbackInsight(data)
    }

    const withInsight = {
      ...data,
      insight: { summary: insightSummary.trim(), generatedAt: new Date().toISOString() },
    }

    const format = request.nextUrl.searchParams.get('format') ?? 'dashboard'
    if (format === 'analytics') {
      return NextResponse.json(apiSuccess(withInsight), { headers: analyticsCacheHeaders(60, 300) })
    }

    const dashboard = await mapToDashboardData(withInsight, auth.tenantId, auth.userId)

    return NextResponse.json(apiSuccess(dashboard), { headers: analyticsCacheHeaders(60, 300) })
  } catch (err) {
    return handleRouteError(err)
  }
})

function generateFallbackInsight(data: ExecutiveAnalyticsData): string {
  const rev = data.modules.sales.totalRevenue
  const change = data.scorecard.find((s) => s.metric === 'Revenue')?.change ?? 0
  const finance = data.modules.finance
  const hr = data.modules.hr
  const parts = [
    `Revenue for ${data.period} totals $${Math.round(rev).toLocaleString()}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% vs the prior period.`,
    `${data.modules.inventory.reorderRequired.length} products need reorder attention.`,
  ]
  if (finance) {
    parts.push(`Net income $${Math.round(finance.profitAndLoss.netIncome).toLocaleString()}, cash position $${Math.round(finance.cashPosition).toLocaleString()}.`)
  }
  if (hr) {
    parts.push(`Workforce: ${hr.headcount.active} active employees, ${hr.attendance.rate}% attendance rate.`)
  }
  return parts.join(' ')
}
