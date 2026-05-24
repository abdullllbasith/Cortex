import { z } from 'zod'
import { completeStructuredJson } from '@/lib/ml/llmClient'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  prompt: z.string().min(1),
  outputVariable: z.string().default('ai.result'),
  model: z.string().optional(),
})

export const aiDecisionHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.ai_decision')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const prompt = String(ctx.interpolate(cfg.prompt))

  const systemPrompt = `You are a business workflow AI assistant. Respond with valid JSON only.
Use the workflow context provided to make decisions.`

  const result = await completeStructuredJson<Record<string, unknown>>(
    systemPrompt,
    JSON.stringify({ prompt, context: ctx.variables, input: inputData }),
    2048,
  )

  if (!result) throw nodeError('action.ai_decision', 'AI returned empty response')

  ctx.setVariable(cfg.outputVariable, result)
  ctx.appendLog(`AI decision stored in ${cfg.outputVariable}`)

  return {
    outputData: {
      ...inputData,
      aiResult: result,
      outputVariable: cfg.outputVariable,
    },
  }
}
