import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { privateCacheHeaders } from '@/lib/http/cacheHeaders'
import { ExecutiveAgent } from '@/lib/agents/ExecutiveAgent'
import { mapBriefingActions } from '@/lib/analytics/masterDashboardService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const quick = new URL(request.url).searchParams.get('quick') === '1'
    const agent = new ExecutiveAgent(auth.tenantId, auth.userId)
    const briefing = await agent.getDailyBriefing({ skipLlm: quick })
    const priorityActionLinks = mapBriefingActions(briefing.priorityActions as string[])

    return NextResponse.json(
      apiSuccess({
        date: briefing.date,
        executiveSummary: briefing.executiveSummary,
        priorityActions: priorityActionLinks,
        risks: briefing.risks,
        formattedBriefing: briefing.formattedBriefing,
        kpis: briefing.kpis,
      }),
      { headers: privateCacheHeaders(quick ? 120 : 30, quick ? 600 : 120) },
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
