import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { preferencesUpdateSchema } from '@/lib/notifications/schemas'
import { getPreferences, upsertPreferences } from '@/lib/notifications/preferenceService'
import { notificationService } from '@/lib/notifications/notificationService'
import { renderNotificationTemplate } from '@/lib/notifications/notificationTemplates'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const preferences = await getPreferences(auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess({ preferences }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth }) => {
  try {
    const body = preferencesUpdateSchema.parse(await request.json())
    const preferences = await upsertPreferences(auth.tenantId, auth.userId, body.preferences)
    return NextResponse.json(apiSuccess({ preferences }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { test?: boolean }
    if (body.test) {
      const rendered = renderNotificationTemplate('LOW_STOCK_ALERT', {
        productName: 'Sample Widget',
        qty: 3,
      })
      await notificationService.send({
        tenantId: auth.tenantId,
        userId: auth.userId,
        title: `[Test] ${rendered.title}`,
        body: rendered.body,
        type: rendered.type,
        severity: rendered.severity,
        actionUrl: rendered.actionUrl,
        actionLabel: rendered.actionLabel,
        metadata: { test: true },
      })
      return NextResponse.json(apiSuccess({ sent: true }))
    }
    return NextResponse.json(apiSuccess({ sent: false }))
  } catch (err) {
    return handleRouteError(err)
  }
})
