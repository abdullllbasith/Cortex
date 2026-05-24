import { z } from 'zod'
import type { NodeHandler } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  arrayPath: z.string().default('items'),
})

/** Loop execution is handled by WorkflowEngine.runLoopNode */
export const loopHandler: NodeHandler = async ({ inputData, config }) => {
  validateConfig(schema, config, 'control.loop')
  return {
    outputData: { ...inputData, loopHandledByEngine: true },
    branch: 'body',
  }
}

export const loopPlaceholder = loopHandler
