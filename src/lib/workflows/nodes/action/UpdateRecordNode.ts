import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  embedSingleRecord,
} from '@/lib/embeddings/knowledgeIndexer'
import { EmbeddingStatus } from '@prisma/client'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  entity: z.enum(['customer', 'product', 'supplier']),
  entityId: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
})

const KNOWLEDGE_FIELDS: Record<string, string[]> = {
  customer: ['profile', 'preferences', 'purchaseHistory'],
  product: ['name', 'catalog', 'inventoryLevel', 'supplierInfo'],
  supplier: ['name', 'performanceScore', 'reliabilityMetrics'],
}

export const updateRecordHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.update_record')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const entityId = String(ctx.interpolate(cfg.entityId))
  const fields = ctx.interpolate(cfg.fields) as Record<string, unknown>
  const { tenantId } = engineCtx

  let updated: Record<string, unknown> = {}
  let needsReembed = false

  if (cfg.entity === 'customer') {
    const existing = await prisma.customer.findFirst({ where: { id: entityId, tenantId } })
    if (!existing) throw nodeError('action.update_record', `Customer ${entityId} not found`)
    const data: Record<string, unknown> = {}
    if (fields.profile) data.profile = fields.profile
    if (fields.preferences) data.preferences = fields.preferences
    if (fields.purchaseHistory) data.purchaseHistory = fields.purchaseHistory
    needsReembed = KNOWLEDGE_FIELDS.customer.some((f) => f in data)
    const row = await prisma.customer.update({
      where: { id: entityId },
      data: { ...data, version: { increment: 1 }, ...(needsReembed ? { embeddingStatus: EmbeddingStatus.PENDING } : {}) },
    })
    updated = row as unknown as Record<string, unknown>
    if (needsReembed) {
      await embedSingleRecord(tenantId, 'customer', row.id)
    }
  } else if (cfg.entity === 'product') {
    const existing = await prisma.product.findFirst({ where: { id: entityId, tenantId } })
    if (!existing) throw nodeError('action.update_record', `Product ${entityId} not found`)
    const data: Record<string, unknown> = {}
    if (fields.name) data.name = String(fields.name)
    if (fields.catalog) data.catalog = fields.catalog
    if (fields.inventoryLevel != null) data.inventoryLevel = Number(fields.inventoryLevel)
    if (fields.supplierInfo) data.supplierInfo = fields.supplierInfo
    needsReembed = KNOWLEDGE_FIELDS.product.some((f) => f in data)
    const row = await prisma.product.update({
      where: { id: entityId },
      data: { ...data, version: { increment: 1 }, ...(needsReembed ? { embeddingStatus: EmbeddingStatus.PENDING } : {}) },
    })
    updated = row as unknown as Record<string, unknown>
    if (needsReembed) {
      await embedSingleRecord(tenantId, 'product', row.id)
    }
  } else {
    const existing = await prisma.supplier.findFirst({ where: { id: entityId, tenantId } })
    if (!existing) throw nodeError('action.update_record', `Supplier ${entityId} not found`)
    const data: Record<string, unknown> = {}
    if (fields.name) data.name = String(fields.name)
    if (fields.performanceScore != null) data.performanceScore = Number(fields.performanceScore)
    if (fields.reliabilityMetrics) data.reliabilityMetrics = fields.reliabilityMetrics
    needsReembed = KNOWLEDGE_FIELDS.supplier.some((f) => f in data)
    const row = await prisma.supplier.update({
      where: { id: entityId },
      data: { ...data, version: { increment: 1 }, ...(needsReembed ? { embeddingStatus: EmbeddingStatus.PENDING } : {}) },
    })
    updated = row as unknown as Record<string, unknown>
    if (needsReembed) {
      await embedSingleRecord(tenantId, 'supplier', row.id)
    }
  }

  ctx.appendLog(`Updated ${cfg.entity} ${entityId}${needsReembed ? ' (re-embedding triggered)' : ''}`)
  ctx.setVariable(`${cfg.entity}`, updated)

  return {
    outputData: {
      ...inputData,
      entity: cfg.entity,
      entityId,
      updated,
      reEmbedded: needsReembed,
    },
  }
}
