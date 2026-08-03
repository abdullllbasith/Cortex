import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { notificationListQuerySchema } from '@/lib/notifications/schemas'
import { listNotifications } from '@/lib/notifications/notificationService'
import { toNotificationDTO } from '@/lib/notifications/types'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = notificationListQuerySchema.parse(parseQuery(request))
    const result = await listNotifications({
      tenantId: auth.tenantId,
      userId: auth.userId,
      isRead: query.isRead === undefined ? undefined : query.isRead === 'true',
      type: query.type,
      severity: query.severity,
      page: query.page,
      limit: query.limit,
      search: query.search,
    })

    return NextResponse.json(
      apiSuccess({
        notifications: result.notifications.map(toNotificationDTO),
        unreadCount: result.unreadCount,
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
