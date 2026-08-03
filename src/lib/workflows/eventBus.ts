import { EventEmitter } from 'events'

export type SaiosEventType =
  | 'new_order'
  | 'low_stock'
  | 'new_customer'
  | 'payment_received'
  | 'stock_level_changed'
  | 'stock_below_reorder'
  | 'po_status_changed'
  | 'deal_lost'
  | 'new_contact_created'
  | 'deal_won'
  | 'follow_up_due'
  | 'invoice_sent'
  | 'invoice_overdue'
  | 'bill_overdue'
  | 'order_confirmed'
  | 'order_delivered'
  | 'new_employee_joined'
  | 'goods_received'

export interface SaiosEventPayload {
  tenantId: string
  eventType: SaiosEventType
  data: Record<string, unknown>
  timestamp: string
}

class SaiosEventBusClass extends EventEmitter {
  emitEvent(payload: SaiosEventPayload): void {
    this.emit(payload.eventType, payload)
    this.emit('*', payload)
  }

  onEvent(eventType: SaiosEventType | '*', handler: (payload: SaiosEventPayload) => void): void {
    this.on(eventType, handler)
  }

  offEvent(eventType: SaiosEventType | '*', handler: (payload: SaiosEventPayload) => void): void {
    this.off(eventType, handler)
  }
}

export const saiosEventBus = new SaiosEventBusClass()

export function emitSaiosEvent(
  tenantId: string,
  eventType: SaiosEventType,
  data: Record<string, unknown>,
): void {
  saiosEventBus.emitEvent({
    tenantId,
    eventType,
    data,
    timestamp: new Date().toISOString(),
  })
}
