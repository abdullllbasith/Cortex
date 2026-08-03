import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { createPO } from '@/lib/inventory/purchaseOrderService'
import { type ReorderSuggestion } from '@/lib/inventory/reorderService'
import type { TenantSettings } from '@/lib/settings/types'
import { WorkflowContext, getByPath } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { validateConfig } from '../utils'

const schema = z.object({
  supplierIdField: z.string().default('reorderSuggestion.supplierId'),
  suggestionsField: z.string().default('reorderSuggestions'),
  autoApproveThreshold: z.number().min(0).optional(),
  respectAutoApprove: z.boolean().default(true),
  sendToSupplier: z.boolean().default(false),
})

function asSuggestions(value: unknown): ReorderSuggestion[] {
  if (!Array.isArray(value)) return []
  return value as ReorderSuggestion[]
}

async function resolveDefaultWarehouseId(tenantId: string): Promise<string> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!warehouse) throw new Error('No active warehouse configured')
  return warehouse.id
}

export const createPurchaseOrderHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.create_purchase_order')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const vars = { ...ctx.variables, ...inputData }
  const actorId = engineCtx.triggeredBy !== 'system' ? engineCtx.triggeredBy : undefined

  let suggestions = asSuggestions(getByPath(vars, cfg.suggestionsField))
  if (!suggestions.length) {
    const single = inputData.reorderSuggestion as ReorderSuggestion | undefined
    if (single?.productId) suggestions = [single]
  }

  const supplierId = String(getByPath(vars, cfg.supplierIdField) ?? suggestions[0]?.supplierId ?? '').trim()
  if (!supplierId || !suggestions.length) {
    ctx.appendLog('Skipped PO — missing supplier or suggestions')
    return { outputData: { ...inputData, purchaseOrder: null, skipped: true }, branch: 'false' }
  }

  const scoped = suggestions.filter((s) => s.supplierId === supplierId)
  const lines = scoped.length ? scoped : suggestions
  const estimatedTotal = lines.reduce((sum, s) => sum + (s.lineTotal || s.suggestedQty * s.unitCost), 0)

  if (cfg.respectAutoApprove) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: engineCtx.tenantId },
      select: { settings: true },
    })
    const settings = (tenant?.settings ?? {}) as TenantSettings & {
      inventory?: { autoApproveReorder?: boolean; autoApproveThreshold?: number }
    }
    const threshold = cfg.autoApproveThreshold ?? settings.inventory?.autoApproveThreshold ?? 5000
    const autoEnabled = settings.inventory?.autoApproveReorder ?? false
    const belowThreshold = estimatedTotal <= threshold

    if (!autoEnabled || !belowThreshold) {
      ctx.appendLog(
        `PO requires approval — total $${estimatedTotal.toFixed(2)}, threshold $${threshold}, autoApprove=${autoEnabled}`,
      )
      return {
        outputData: {
          ...inputData,
          purchaseOrder: null,
          poRequiresApproval: true,
          estimatedTotal,
          approvalThreshold: threshold,
          skipped: true,
        },
        branch: 'false',
      }
    }
  }

  const warehouseId = await resolveDefaultWarehouseId(engineCtx.tenantId)
  const po = await createPO(
    engineCtx.tenantId,
    {
      supplierId,
      warehouseId,
      shippingCost: 0,
      currency: 'USD',
      items: lines.map((s) => ({
        productId: s.productId,
        quantity: s.suggestedQty,
        unitCost: s.unitCost,
        taxRate: 0,
      })),
    },
    actorId,
  )

  if (cfg.sendToSupplier) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: engineCtx.tenantId },
      select: { name: true, email: true },
    })
    ctx.appendLog(`PO ${po.poNumber} queued for supplier ${supplier?.name ?? supplierId} (${supplier?.email ?? 'no email'})`)
  }

  ctx.appendLog(`Created PO ${po.poNumber} ($${estimatedTotal.toFixed(2)})`)

  return {
    outputData: {
      ...inputData,
      purchaseOrder: po,
      poId: po.id,
      poNumber: po.poNumber,
      estimatedTotal,
      skipped: false,
    },
    branch: 'true',
  }
}
