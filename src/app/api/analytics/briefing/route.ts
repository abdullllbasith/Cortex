import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { ExecutiveAgent } from '@/lib/agents/ExecutiveAgent'
import { mapBriefingActions } from '@/lib/analytics/masterDashboardService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const agent = new ExecutiveAgent(auth.tenantId, auth.userId)
    const briefing = await agent.getDailyBriefing()
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
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
