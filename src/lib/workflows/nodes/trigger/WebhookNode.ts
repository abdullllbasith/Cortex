import type { NodeHandler } from '../../types'

export const webhookTriggerHandler: NodeHandler = async ({ inputData }) => {
  return {
    outputData: {
      ...inputData,
      triggeredAt: new Date().toISOString(),
      trigger: 'webhook',
    },
  }
}

export const manualTriggerHandler: NodeHandler = async ({ inputData }) => {
  return {
    outputData: {
      ...inputData,
      triggeredAt: new Date().toISOString(),
      trigger: 'manual',
    },
  }
}
