import { z } from 'zod'
import type { NodeHandler } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  eventType: z.enum([
    'new_order',
    'low_stock',
    'new_customer',
    'payment_received',
    'stock_level_changed',
    'stock_below_reorder',
    'po_status_changed',
    'deal_lost',
    'new_contact_created',
    'deal_won',
    'follow_up_due',
    'invoice_sent',
    'invoice_overdue',
    'bill_overdue',
    'order_confirmed',
    'order_delivered',
    'new_employee_joined',
    'goods_received',
  ]),
})

export const eventTriggerHandler: NodeHandler = async ({ inputData, config }) => {
  const cfg = validateConfig(schema, config, 'trigger.event')
  return {
    outputData: {
      ...inputData,
      eventType: cfg.eventType,
      triggeredAt: new Date().toISOString(),
      trigger: 'event',
    },
  }
}
