import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import {
  getOverviewMetrics,
  getPlanDistribution,
  getChurnMetrics,
} from '@/lib/admin/platformMetrics'

export const GET = requireAdminAuth(async (_request, { auth }) => {
  try {
    const [overview, planDistribution, churn] = await Promise.all([
      getOverviewMetrics(),
      getPlanDistribution(),
      getChurnMetrics(30),
    ])

    return NextResponse.json(
      apiSuccess({
        overview,
        planDistribution,
        churn,
        requestedBy: auth.email,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
