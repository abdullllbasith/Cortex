import { EventEmitter } from 'events'

export type SaiosEventType =
  | 'new_order'
  | 'low_stock'
  | 'new_customer'
  | 'payment_received'
  | 'stock_level_changed'
  | 'stock_below_reorder'
  | 'po_status_changed'

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
