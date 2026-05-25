import { z } from 'zod'
import { generateReorderSuggestions } from '@/lib/inventory/reorderService'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  productIdField: z.string().default('productId'),
  urgency: z.enum(['critical', 'warning', 'all']).default('all'),
})

export const generateReorderSuggestionHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.generate_reorder_suggestion')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const productId = String(getByPath(vars, cfg.productIdField) ?? '').trim() || undefined

  const result = await generateReorderSuggestions(engineCtx.tenantId, cfg.urgency, { productId })
  const flat = result.groups.flatMap((g) =>
    g.suggestions.map((s) => ({ ...s, supplierGroup: g })),
  )
  const primary = flat[0] ?? null

  ctx.appendLog(
    productId
      ? `Generated ${flat.length} reorder suggestion(s) for product ${productId}`
      : `Generated ${result.totalSuggestions} reorder suggestion(s)`,
  )

  return {
    outputData: {
      ...inputData,
      reorderSuggestions: flat,
      reorderGroups: result.groups,
      reorderSuggestion: primary,
      reorderSuggestionCount: result.totalSuggestions,
      lastReorderCheck: result.lastCheckedAt,
    },
  }
}
