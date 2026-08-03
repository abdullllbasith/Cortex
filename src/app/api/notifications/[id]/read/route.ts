import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { markNotificationRead } from '@/lib/notifications/notificationService'

export const PATCH = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const updated = await markNotificationRead(auth.tenantId, auth.userId, id)
    return NextResponse.json(apiSuccess({ updated }))
  } catch (err) {
    return handleRouteError(err)
  }
})
