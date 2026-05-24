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
