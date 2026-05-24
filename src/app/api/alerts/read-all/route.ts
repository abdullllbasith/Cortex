import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { markAllAlertsRead } from '@/lib/ml/alertEngine'

export const POST = withTenantAuth(async (_request, { auth }) => {
  try {
    const result = await markAllAlertsRead(auth.tenantId)
    return NextResponse.json(apiSuccess({ count: result.count }))
  } catch (err) {
    return handleRouteError(err)
  }
})
