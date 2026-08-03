import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { TenantAuthError } from '@/middleware/tenantAuth'
import { refreshPredictionsForTenant } from '@/lib/ml/predictionOrchestrator'

import { PERMISSIONS } from '@/lib/auth/permissions'

export const POST = withTenantAuth(async (_request, { auth }) => {
  try {
    const isAdmin =
      (auth.permissions as string[]).includes('*') ||
      auth.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
    if (!isAdmin && process.env.AUTH_DEV_MODE !== 'true') {
      throw new TenantAuthError('Admin access required', 403, 'FORBIDDEN')
    }

    const summary = await refreshPredictionsForTenant(auth.tenantId)
    return NextResponse.json(apiSuccess(summary))
  } catch (err) {
    return handleRouteError(err)
  }
})
