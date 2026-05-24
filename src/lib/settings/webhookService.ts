import { prisma } from '@/lib/db/prisma'
import { generateSecureToken } from '@/lib/security/encryption'

export const WEBHOOK_EVENT_GROUPS = {
  Alerts: ['alert.created', 'alert.resolved'],
  Workflows: ['workflow.started', 'workflow.completed', 'workflow.failed'],
  Knowledge: ['entity.created', 'entity.updated', 'entity.deleted'],
  Security: ['security.login', 'security.permission_denied'],
  Billing: ['billing.payment_received', 'billing.plan_changed'],
  Inventory: [
    'inventory.stock_level_changed',
    'inventory.stock_below_reorder',
    'inventory.po_status_changed',
  ],
} as const

export async function listWebhooks(tenantId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createWebhook(
  tenantId: string,
  data: { url: string; events: string[] },
) {
  const secret = `whsec_${generateSecureToken(24)}`
  return prisma.webhookEndpoint.create({
    data: {
      tenantId,
      url: data.url,
      secret,
      events: data.events as never,
    },
  })
}

export async function deleteWebhook(id: string, tenantId: string) {
  return prisma.webhookEndpoint.deleteMany({ where: { id, tenantId } })
}

export async function listDeliveries(webhookId: string, tenantId: string, limit = 50) {
  return prisma.webhookDelivery.findMany({
    where: { webhookId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function sendTestWebhook(webhookId: string, tenantId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: webhookId, tenantId, isActive: true },
  })
  if (!endpoint) throw new Error('Webhook not found')

  const payload = {
    type: 'test.event',
    tenantId,
    timestamp: new Date().toISOString(),
    data: { message: 'SAIOS test webhook delivery' },
  }

  const start = Date.now()
  let statusCode: number | null = null
  let success = false
  let responseBody: string | null = null

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SAIOS-Signature': endpoint.secret,
        'X-SAIOS-Event': 'test.event',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    statusCode = res.status
    success = res.ok
    responseBody = (await res.text()).slice(0, 500)
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Delivery failed'
  }

  const responseTimeMs = Date.now() - start

  await prisma.webhookDelivery.create({
    data: {
      webhookId: endpoint.id,
      tenantId,
      eventType: 'test.event',
      statusCode,
      responseTimeMs,
      success,
      payload: payload as never,
      responseBody,
    },
  })

  const recent = await prisma.webhookDelivery.findMany({
    where: { webhookId: endpoint.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { success: true },
  })
  const successRate = recent.length
    ? (recent.filter((d) => d.success).length / recent.length) * 100
    : success
      ? 100
      : 0

  await prisma.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { lastDeliveryAt: new Date(), successRate },
  })

  return { success, statusCode, responseTimeMs, responseBody }
}

export async function retryDelivery(deliveryId: string, tenantId: string) {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: deliveryId, tenantId },
    include: { webhook: true },
  })
  if (!delivery) throw new Error('Delivery not found')
  return sendTestWebhook(delivery.webhookId, tenantId)
}
