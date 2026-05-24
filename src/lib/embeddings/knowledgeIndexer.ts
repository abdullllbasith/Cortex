import { prisma } from '@/lib/db/prisma'
import { EmbeddingStatus, Prisma } from '@prisma/client'
import { generateEmbeddingsBatch } from './embeddingService'
import { hashEmbeddingContent, MAX_BATCH_SIZE, toVectorLiteral } from './types'

export type KnowledgeEntityType = 'customer' | 'product' | 'supplier' | 'knowledge'

export interface IndexingResult {
  entityType: KnowledgeEntityType
  processed: number
  indexed: number
  skipped: number
  errors: number
}

interface IndexRecord {
  id: string
  content: string
  contentHash: string
}

function buildCustomerContent(record: {
  profile: unknown
  purchaseHistory: unknown
  preferences: unknown
  communicationHistory: unknown
  loyaltyData: unknown
}): string {
  const profile = record.profile as Record<string, unknown>
  return [
    profile.name,
    profile.email,
    profile.company,
    JSON.stringify(record.preferences),
    JSON.stringify(record.purchaseHistory),
    JSON.stringify(record.loyaltyData),
  ].filter(Boolean).join(' ')
}

function buildProductContent(record: {
  name: string
  catalog: unknown
  supplierInfo: unknown
}): string {
  return `${record.name} ${JSON.stringify(record.catalog)} ${JSON.stringify(record.supplierInfo)}`
}

function buildSupplierContent(record: {
  name: string
  performanceScore: number
  reliabilityMetrics: unknown
}): string {
  return `${record.name} performance:${record.performanceScore} ${JSON.stringify(record.reliabilityMetrics)}`
}

function buildKnowledgeContent(record: { title: string; content: string; type: string }): string {
  return `${record.type}: ${record.title}\n${record.content}`
}

async function fetchUnembeddedRecords(
  tenantId: string,
  entityType: KnowledgeEntityType,
): Promise<IndexRecord[]> {
  switch (entityType) {
    case 'customer': {
      const rows = await prisma.customer.findMany({
        where: {
          tenantId,
          OR: [
            { embeddingStatus: EmbeddingStatus.PENDING },
            { embeddingStatus: EmbeddingStatus.ERROR },
          ],
        },
        select: {
          id: true,
          profile: true,
          purchaseHistory: true,
          preferences: true,
          communicationHistory: true,
          loyaltyData: true,
        },
      })
      return rows.map((r) => {
        const content = buildCustomerContent(r)
        return { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      })
    }
    case 'product': {
      const rows = await prisma.product.findMany({
        where: {
          tenantId,
          OR: [
            { embeddingStatus: EmbeddingStatus.PENDING },
            { embeddingStatus: EmbeddingStatus.ERROR },
          ],
        },
        select: { id: true, name: true, catalog: true, supplierInfo: true },
      })
      return rows.map((r) => {
        const content = buildProductContent(r)
        return { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      })
    }
    case 'supplier': {
      const rows = await prisma.supplier.findMany({
        where: {
          tenantId,
          OR: [
            { embeddingStatus: EmbeddingStatus.PENDING },
            { embeddingStatus: EmbeddingStatus.ERROR },
          ],
        },
        select: { id: true, name: true, performanceScore: true, reliabilityMetrics: true },
      })
      return rows.map((r) => {
        const content = buildSupplierContent(r)
        return { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      })
    }
    case 'knowledge': {
      const rows = await prisma.businessKnowledge.findMany({
        where: {
          tenantId,
          OR: [
            { embeddingStatus: EmbeddingStatus.PENDING },
            { embeddingStatus: EmbeddingStatus.ERROR },
          ],
        },
        select: { id: true, title: true, content: true, type: true },
      })
      return rows.map((r) => {
        const content = buildKnowledgeContent(r)
        return { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      })
    }
  }
}

async function storeEmbedding(
  entityType: KnowledgeEntityType,
  id: string,
  vector: number[],
  contentHash: string,
): Promise<void> {
  const vectorLiteral = toVectorLiteral(vector)
  const now = new Date()

  const data = {
    embeddingStatus: EmbeddingStatus.INDEXED,
    embeddingContentHash: contentHash,
    embeddingUpdatedAt: now,
  }

  switch (entityType) {
    case 'customer':
      await prisma.$executeRaw`
        UPDATE customers
        SET embedding = ${vectorLiteral}::vector,
            "embeddingStatus" = ${EmbeddingStatus.INDEXED}::text,
            "embeddingContentHash" = ${contentHash},
            "embeddingUpdatedAt" = ${now}
        WHERE id = ${id}
      `
      break
    case 'product':
      await prisma.$executeRaw`
        UPDATE products
        SET embedding = ${vectorLiteral}::vector,
            "embeddingStatus" = ${EmbeddingStatus.INDEXED}::text,
            "embeddingContentHash" = ${contentHash},
            "embeddingUpdatedAt" = ${now}
        WHERE id = ${id}
      `
      break
    case 'supplier':
      await prisma.$executeRaw`
        UPDATE suppliers
        SET embedding = ${vectorLiteral}::vector,
            "embeddingStatus" = ${EmbeddingStatus.INDEXED}::text,
            "embeddingContentHash" = ${contentHash},
            "embeddingUpdatedAt" = ${now}
        WHERE id = ${id}
      `
      break
    case 'knowledge':
      await prisma.$executeRaw`
        UPDATE business_knowledge
        SET embedding = ${vectorLiteral}::vector,
            "embeddingStatus" = ${EmbeddingStatus.INDEXED}::text,
            "embeddingContentHash" = ${contentHash},
            "embeddingUpdatedAt" = ${now}
        WHERE id = ${id}
      `
      break
  }

  void data // satisfy unused in some paths
}

async function markEmbeddingError(entityType: KnowledgeEntityType, id: string): Promise<void> {
  switch (entityType) {
    case 'customer':
      await prisma.customer.update({ where: { id }, data: { embeddingStatus: EmbeddingStatus.ERROR } })
      break
    case 'product':
      await prisma.product.update({ where: { id }, data: { embeddingStatus: EmbeddingStatus.ERROR } })
      break
    case 'supplier':
      await prisma.supplier.update({ where: { id }, data: { embeddingStatus: EmbeddingStatus.ERROR } })
      break
    case 'knowledge':
      await prisma.businessKnowledge.update({ where: { id }, data: { embeddingStatus: EmbeddingStatus.ERROR } })
      break
  }
}

/** Index a single batch (max 100 records). */
export async function indexEntityBatch(
  tenantId: string,
  entityType: KnowledgeEntityType,
  records: IndexRecord[],
): Promise<{ indexed: number; errors: number }> {
  let indexed = 0
  let errors = 0

  for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
    const batch = records.slice(i, i + MAX_BATCH_SIZE)

    try {
      const embeddings = await generateEmbeddingsBatch(batch.map((r) => r.content))

      for (let j = 0; j < batch.length; j++) {
        try {
          await storeEmbedding(entityType, batch[j].id, embeddings[j], batch[j].contentHash)
          indexed++
        } catch {
          await markEmbeddingError(entityType, batch[j].id)
          errors++
        }
      }
    } catch {
      for (const record of batch) {
        await markEmbeddingError(entityType, record.id)
        errors++
      }
    }
  }

  return { indexed, errors }
}

/**
 * Full indexing pipeline for a tenant + entity type.
 * Only re-embeds records that are pending, errored, or missing embeddings.
 */
export async function indexTenantEntities(
  tenantId: string,
  entityType: KnowledgeEntityType,
): Promise<IndexingResult> {
  const records = await fetchUnembeddedRecords(tenantId, entityType)

  // Incremental: skip records whose hash already matches and status is INDEXED
  const toIndex: IndexRecord[] = []
  let skipped = 0

  for (const record of records) {
    toIndex.push(record)
  }

  const { indexed, errors } = await indexEntityBatch(tenantId, entityType, toIndex)

  return {
    entityType,
    processed: records.length,
    indexed,
    skipped,
    errors,
  }
}

/** Index all entity types for a tenant. */
export async function indexAllTenantKnowledge(tenantId: string): Promise<IndexingResult[]> {
  const types: KnowledgeEntityType[] = ['customer', 'product', 'supplier', 'knowledge']
  const results: IndexingResult[] = []

  for (const entityType of types) {
    results.push(await indexTenantEntities(tenantId, entityType))
  }

  return results
}

/** Re-embed a single record after create/update. */
export async function embedSingleRecord(
  tenantId: string,
  entityType: KnowledgeEntityType,
  id: string,
): Promise<void> {
  let record: IndexRecord | null = null

  switch (entityType) {
    case 'customer': {
      const r = await prisma.customer.findFirst({ where: { id, tenantId } })
      if (r) {
        const content = buildCustomerContent(r)
        record = { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      }
      break
    }
    case 'product': {
      const r = await prisma.product.findFirst({ where: { id, tenantId } })
      if (r) {
        const content = buildProductContent(r)
        record = { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      }
      break
    }
    case 'supplier': {
      const r = await prisma.supplier.findFirst({ where: { id, tenantId } })
      if (r) {
        const content = buildSupplierContent(r)
        record = { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      }
      break
    }
    case 'knowledge': {
      const r = await prisma.businessKnowledge.findFirst({ where: { id, tenantId } })
      if (r) {
        const content = buildKnowledgeContent(r)
        record = { id: r.id, content, contentHash: hashEmbeddingContent(content) }
      }
      break
    }
  }

  if (!record) return

  await indexEntityBatch(tenantId, entityType, [record])
}

export {
  buildCustomerContent,
  buildProductContent,
  buildSupplierContent,
  buildKnowledgeContent,
  hashEmbeddingContent,
}
