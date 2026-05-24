import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { markAllNotificationsRead } from '@/lib/notifications/notificationService'

export const PATCH = withTenantAuth(async (_request, { auth }) => {
  try {
    const count = await markAllNotificationsRead(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess({ count }))
  } catch (err) {
    return handleRouteError(err)
  }
})
