import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getMasterDashboardData } from '@/lib/analytics/masterDashboardService'
import { noStoreHeaders } from '@/lib/http/cacheHeaders'

export const dynamic = 'force-dynamic'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getMasterDashboardData(auth.tenantId, auth.userId)
    // Live KPIs/charts — never serve a stale empty revenue window after seed refresh.
    return NextResponse.json(apiSuccess(data), { headers: noStoreHeaders() })
  } catch (err) {
    return handleRouteError(err)
  }
})
