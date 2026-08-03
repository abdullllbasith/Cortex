import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { getBillingOverview } from '@/lib/settings/billingService'

export const GET = requirePermission(PERMISSIONS.BILLING_MANAGE)(
  async (_request, { auth }) => {
    try {
      const data = await getBillingOverview(auth.tenantId)
      return NextResponse.json(apiSuccess(data))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)
