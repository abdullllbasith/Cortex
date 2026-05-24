import { z } from 'zod'
import { WorkflowContext } from '../../core/WorkflowContext'
import { getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']),
  value: z.unknown().optional(),
})

const schema = z.object({
  conditions: z.array(conditionSchema).min(1),
  logic: z.enum(['AND', 'OR']).default('AND'),
})

function evaluateCondition(
  variables: Record<string, unknown>,
  cond: z.infer<typeof conditionSchema>,
): boolean {
  const actual = getByPath(variables, cond.field)
  switch (cond.operator) {
    case 'eq': return actual == cond.value
    case 'neq': return actual != cond.value
    case 'gt': return Number(actual) > Number(cond.value)
    case 'gte': return Number(actual) >= Number(cond.value)
    case 'lt': return Number(actual) < Number(cond.value)
    case 'lte': return Number(actual) <= Number(cond.value)
    case 'contains':
      return String(actual).toLowerCase().includes(String(cond.value).toLowerCase())
    case 'exists':
      return actual !== undefined && actual !== null
    default:
      return false
  }
}

export const conditionHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'control.condition')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }

  const results = cfg.conditions.map((c) => evaluateCondition(vars, c))
  const passed = cfg.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)

  ctx.appendLog(`Condition evaluated: ${passed ? 'true' : 'false'} (${cfg.logic})`)

  return {
    outputData: { ...inputData, conditionResult: passed, evaluated: results },
    branch: passed ? 'true' : 'false',
  }
}
