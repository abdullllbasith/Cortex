import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getHrDashboard } from '@/lib/hr/hrDashboardService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getHrDashboard(auth.tenantId)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
