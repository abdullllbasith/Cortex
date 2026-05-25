import { prisma } from '@/lib/db/prisma'
import { emitSaiosEvent, type SaiosEventType } from '@/lib/workflows/eventBus'

/** Outbound webhook event types (Module 12 inventory). */
export const INVENTORY_WEBHOOK_EVENTS = {
  STOCK_LEVEL_CHANGED: 'inventory.stock_level_changed',
  STOCK_BELOW_REORDER: 'inventory.stock_below_reorder',
  PO_STATUS_CHANGED: 'inventory.po_status_changed',
} as const

export type InventoryWebhookEvent =
  (typeof INVENTORY_WEBHOOK_EVENTS)[keyof typeof INVENTORY_WEBHOOK_EVENTS]

const EVENT_TO_SAIOS: Record<InventoryWebhookEvent, SaiosEventType> = {
  [INVENTORY_WEBHOOK_EVENTS.STOCK_LEVEL_CHANGED]: 'stock_level_changed',
  [INVENTORY_WEBHOOK_EVENTS.STOCK_BELOW_REORDER]: 'stock_below_reorder',
  [INVENTORY_WEBHOOK_EVENTS.PO_STATUS_CHANGED]: 'po_status_changed',
}

async function deliverToWebhookEndpoints(
  tenantId: string,
  eventType: InventoryWebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, url: true, secret: true, events: true },
  })

  const payload = {
    type: eventType,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  }

  for (const endpoint of endpoints) {
    const subscribed = endpoint.events as string[]
    if (!subscribed.includes(eventType) && !subscribed.includes('*')) continue

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
          'X-SAIOS-Event': eventType,
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

    await prisma.webhookDelivery.create({
      data: {
        webhookId: endpoint.id,
        tenantId,
        eventType,
        statusCode,
        responseTimeMs: Date.now() - start,
        success,
        payload: payload as never,
        responseBody,
      },
    })
  }
}

function emitInventoryEvent(
  tenantId: string,
  webhookEvent: InventoryWebhookEvent,
  data: Record<string, unknown>,
): void {
  const saiosType = EVENT_TO_SAIOS[webhookEvent]
  emitSaiosEvent(tenantId, saiosType, { ...data, webhookEvent })
  void deliverToWebhookEndpoints(tenantId, webhookEvent, data)

  if (webhookEvent === INVENTORY_WEBHOOK_EVENTS.STOCK_BELOW_REORDER) {
    emitSaiosEvent(tenantId, 'low_stock', data)
  }
}

export function emitStockLevelChanged(
  tenantId: string,
  payload: {
    productId: string
    productName: string
    sku: string
    warehouseId: string
    transactionType: string
    quantity: number
    totalOnHand: number
    ledgerId?: string
    notes?: string | null
  },
): void {
  emitInventoryEvent(tenantId, INVENTORY_WEBHOOK_EVENTS.STOCK_LEVEL_CHANGED, payload)
}

export function emitStockBelowReorder(
  tenantId: string,
  payload: {
    productId: string
    productName: string
    sku: string
    quantityOnHand: number
    currentStock?: number
    reorderPoint: number
    supplierId?: string
    leadTimeDays?: number
    suggestedOrderQty?: number
  },
): void {
  emitInventoryEvent(tenantId, INVENTORY_WEBHOOK_EVENTS.STOCK_BELOW_REORDER, {
    ...payload,
    currentStock: payload.currentStock ?? payload.quantityOnHand,
    event: 'STOCK_BELOW_REORDER',
  })
}

export function emitPOStatusChanged(
  tenantId: string,
  payload: {
    poId: string
    poNumber: string
    previousStatus: string
    newStatus: string
    supplierId?: string
    supplierName?: string
  },
): void {
  emitInventoryEvent(tenantId, INVENTORY_WEBHOOK_EVENTS.PO_STATUS_CHANGED, payload)
}
