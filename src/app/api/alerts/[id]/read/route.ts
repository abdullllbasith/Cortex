import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { markAlertRead } from '@/lib/ml/alertEngine'

export const PATCH = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    await markAlertRead(auth.tenantId, id)
    return NextResponse.json(apiSuccess({ id, read: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})
