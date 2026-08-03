import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getCrmDashboard } from '@/lib/crm/crmAnalyticsService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getCrmDashboard(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
