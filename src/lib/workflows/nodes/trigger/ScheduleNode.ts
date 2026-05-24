import { z } from 'zod'
import type { NodeHandler } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  cronExpression: z.string().min(1),
  timezone: z.string().default('UTC'),
})

/** Trigger node — passes through input; scheduling handled by TriggerManager */
export const scheduleTriggerHandler: NodeHandler = async ({ inputData, config }) => {
  validateConfig(schema, config, 'trigger.schedule')
  return {
    outputData: {
      ...inputData,
      triggeredAt: new Date().toISOString(),
      trigger: 'schedule',
    },
  }
}
