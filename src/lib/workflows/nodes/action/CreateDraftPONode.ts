import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { createDraftPO, type ReorderSuggestion } from '@/lib/inventory/reorderService'
import type { TenantSettings } from '@/lib/settings/types'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  respectAutoApprove: z.boolean().default(true),
  supplierIdField: z.string().default('reorderSuggestion.supplierId'),
  suggestionsField: z.string().default('reorderSuggestions'),
})

function asSuggestions(value: unknown): ReorderSuggestion[] {
  if (!Array.isArray(value)) return []
  return value as ReorderSuggestion[]
}

export const createDraftPOHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.create_draft_po')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }

  if (cfg.respectAutoApprove) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: engineCtx.tenantId },
      select: { settings: true },
    })
    const settings = (tenant?.settings ?? {}) as TenantSettings & {
      inventory?: { autoApproveReorder?: boolean }
    }
    if (!settings.inventory?.autoApproveReorder) {
      ctx.appendLog('Skipped draft PO — autoApproveReorder is disabled')
      return {
        outputData: { ...inputData, draftPO: null, skipped: true, reason: 'autoApproveReorder disabled' },
        branch: 'false',
      }
    }
  }

  const supplierId = String(getByPath(vars, cfg.supplierIdField) ?? '').trim()
  if (!supplierId) {
    ctx.appendLog('Skipped draft PO — no supplier assigned')
    return { outputData: { ...inputData, draftPO: null, skipped: true, reason: 'no supplier' } }
  }

  let suggestions = asSuggestions(getByPath(vars, cfg.suggestionsField))
  if (!suggestions.length) {
    const single = inputData.reorderSuggestion as ReorderSuggestion | undefined
    if (single?.productId) suggestions = [single]
  }
  if (!suggestions.length) {
    ctx.appendLog('Skipped draft PO — no reorder suggestions')
    return { outputData: { ...inputData, draftPO: null, skipped: true, reason: 'no suggestions' } }
  }

  const scoped = suggestions.filter((s) => s.supplierId === supplierId)
  const po = await createDraftPO(
    engineCtx.tenantId,
    supplierId,
    scoped.length ? scoped : suggestions,
    engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined,
  )

  ctx.appendLog(`Created draft PO ${po.poNumber}`)

  return {
    outputData: {
      ...inputData,
      draftPO: po,
      poId: po.id,
      poNumber: po.poNumber,
      skipped: false,
    },
    branch: 'true',
  }
}
