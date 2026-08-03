import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { deleteNotification } from '@/lib/notifications/notificationService'

export const DELETE = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const deleted = await deleteNotification(auth.tenantId, auth.userId, id)
    return NextResponse.json(apiSuccess({ deleted }))
  } catch (err) {
    return handleRouteError(err)
  }
})
