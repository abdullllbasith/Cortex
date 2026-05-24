import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { alertListQuerySchema, alertPatchSchema } from '@/lib/ml/schemas'
import {
  dismissAlerts,
  listAlerts,
  markAllAlertsRead,
  markAlertRead,
} from '@/lib/ml/alertEngine'

function mapAlert(a: Awaited<ReturnType<typeof listAlerts>>[number]) {
  const severityMap: Record<string, 'danger' | 'warning' | 'info'> = {
    CRITICAL: 'danger',
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'info',
    INFO: 'info',
  }
  return {
    id: a.id,
    title: a.title,
    message: a.message,
    type: a.type,
    severity: severityMap[a.severity] ?? 'info',
    rawSeverity: a.severity,
    read: a.isRead,
    relatedEntityId: a.relatedEntityId,
    relatedEntityType: a.relatedEntityType,
    createdAt: a.createdAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
  }
}

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = alertListQuerySchema.parse(parseQuery(request))
    const alerts = await listAlerts(auth.tenantId, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
    })
    return NextResponse.json(apiSuccess(alerts.map(mapAlert)))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PATCH = withTenantAuth(async (request, { auth }) => {
  try {
    const body = alertPatchSchema.parse(await request.json())
    if (body.action === 'read') {
      for (const id of body.ids) {
        await markAlertRead(auth.tenantId, id)
      }
    } else {
      await dismissAlerts(auth.tenantId, body.ids)
    }
    return NextResponse.json(apiSuccess({ updated: body.ids.length }))
  } catch (err) {
    return handleRouteError(err)
  }
})
