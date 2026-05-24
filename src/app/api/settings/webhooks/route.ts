import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { webhookCreateSchema } from '@/lib/settings/schemas'
import {
  createWebhook,
  deleteWebhook,
  listDeliveries,
  listWebhooks,
  retryDelivery,
  sendTestWebhook,
  WEBHOOK_EVENT_GROUPS,
} from '@/lib/settings/webhookService'

export const GET = requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
  async (request, { auth }) => {
    try {
      const webhookId = request.nextUrl.searchParams.get('webhookId')
      if (webhookId) {
        const deliveries = await listDeliveries(webhookId, auth.tenantId)
        return NextResponse.json(apiSuccess({ deliveries }))
      }
      const webhooks = await listWebhooks(auth.tenantId)
      return NextResponse.json(apiSuccess({ webhooks, eventGroups: WEBHOOK_EVENT_GROUPS }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

export const POST = requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
  async (request, { auth }) => {
    try {
      const body = await request.json()
      if (body.action === 'test') {
        const result = await sendTestWebhook(body.webhookId, auth.tenantId)
        return NextResponse.json(apiSuccess(result))
      }
      if (body.action === 'retry') {
        const result = await retryDelivery(body.deliveryId, auth.tenantId)
        return NextResponse.json(apiSuccess(result))
      }
      const parsed = webhookCreateSchema.parse(body)
      const webhook = await createWebhook(auth.tenantId, parsed)
      return NextResponse.json(apiSuccess(webhook), { status: 201 })
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

export const DELETE = requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
  async (request, { auth }) => {
    try {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) {
        return NextResponse.json(
          { success: false, error: { message: 'Webhook id required', code: 'VALIDATION_ERROR' } },
          { status: 400 },
        )
      }
      await deleteWebhook(id, auth.tenantId)
      return NextResponse.json(apiSuccess({ deleted: true }))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)
