import { prisma } from '@/lib/db/prisma'
import { EmbeddingStatus, Prisma, BusinessKnowledgeType } from '@prisma/client'
import {
  cacheDelPattern,
  cacheGet,
  cacheSet,
  knowledgeCacheKey,
} from '@/lib/cache/redis'
import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import { embedSingleRecord, hashEmbeddingContent, buildCustomerContent, buildProductContent, buildSupplierContent, buildKnowledgeContent } from '@/lib/embeddings/knowledgeIndexer'
import { sanitizePostgresText } from '@/lib/knowledge/sanitizeText'
import { emitSaiosEvent } from '@/lib/workflows/eventBus'
import { toWorkflowCustomerPayload } from '@/lib/workflows/customerPayload'
import { triggerManager } from '@/lib/workflows/TriggerManager'
import type {
  CustomerCreateInput,
  CustomerUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
  SupplierCreateInput,
  SupplierUpdateInput,
  KnowledgeCreateInput,
  KnowledgeUpdateInput,
} from './schemas'

export class OptimisticLockError extends Error {
  constructor() {
    super('Record was modified by another user. Please refresh and try again.')
    this.name = 'OptimisticLockError'
  }
}

export interface ListOptions {
  page?: number
  limit?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  type?: BusinessKnowledgeType
  cursor?: string
}

async function logAudit(
  tenantId: string,
  entityType: string,
  entityId: string,
  action: string,
  changes: Record<string, unknown>,
  actorId?: string,
) {
  await prisma.knowledgeAuditLog.create({
    data: {
      tenantId,
      entityType,
      entityId,
      action,
      changes: changes as Prisma.InputJsonValue,
      actorId,
    },
  })
}

async function invalidateEntityCache(tenantId: string, entity: string) {
  await cacheDelPattern(knowledgeCacheKey(tenantId, entity, '*'))
}

function buildSearchFilter(search: string | undefined): Prisma.CustomerWhereInput {
  if (!search) return {}
  return {
    OR: [
      { profile: { path: ['name'], string_contains: search } },
      { profile: { path: ['email'], string_contains: search } },
      { profile: { path: ['company'], string_contains: search } },
    ],
  }
}

export class KnowledgeRepository {
  // ── Customers ──────────────────────────────────────────────────────────────

  async listCustomers(tenantId: string, opts: ListOptions = {}) {
    const { page = 1, limit = 20, search, sort = 'updatedAt', order = 'desc' } = opts
    const cacheKey = knowledgeCacheKey(tenantId, 'customers', `list:${page}:${limit}:${search ?? ''}`)

    const cached = await cacheGet<{ data: unknown[]; total: number }>(cacheKey)
    if (cached) return cached

    const where: Prisma.CustomerWhereInput = { tenantId, ...buildSearchFilter(search) }
    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.customer.count({ where }),
    ])

    const result = { data, total }
    await cacheSet(cacheKey, result)
    return result
  }

  async getCustomer(tenantId: string, id: string) {
    const cacheKey = knowledgeCacheKey(tenantId, 'customers', id)
    const cached = await cacheGet<unknown>(cacheKey)
    if (cached) return cached

    const record = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (record) await cacheSet(cacheKey, record)
    return record
  }

  async createCustomer(tenantId: string, input: CustomerCreateInput, actorId?: string) {
    const content = buildCustomerContent(input)
    const record = await prisma.customer.create({
      data: {
        tenantId,
        profile: input.profile as Prisma.InputJsonValue,
        purchaseHistory: input.purchaseHistory as Prisma.InputJsonValue,
        preferences: input.preferences as Prisma.InputJsonValue,
        communicationHistory: input.communicationHistory as Prisma.InputJsonValue,
        loyaltyData: input.loyaltyData as Prisma.InputJsonValue,
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })

    await logAudit(tenantId, 'customer', record.id, 'CREATE', input as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'customers')
    void embedSingleRecord(tenantId, 'customer', record.id)

    void triggerManager.initialize().then(() => {
      emitSaiosEvent(tenantId, 'new_customer', toWorkflowCustomerPayload(record))
    }).catch(() => {
      emitSaiosEvent(tenantId, 'new_customer', toWorkflowCustomerPayload(record))
    })

    return record
  }

  async updateCustomer(tenantId: string, id: string, input: CustomerUpdateInput, actorId?: string) {
    const { version, ...data } = input
    const content = buildCustomerContent(data as CustomerCreateInput)

    const result = await prisma.customer.updateMany({
      where: { id, tenantId, version },
      data: {
        ...(data.profile !== undefined && { profile: data.profile as Prisma.InputJsonValue }),
        ...(data.purchaseHistory !== undefined && { purchaseHistory: data.purchaseHistory as Prisma.InputJsonValue }),
        ...(data.preferences !== undefined && { preferences: data.preferences as Prisma.InputJsonValue }),
        ...(data.communicationHistory !== undefined && { communicationHistory: data.communicationHistory as Prisma.InputJsonValue }),
        ...(data.loyaltyData !== undefined && { loyaltyData: data.loyaltyData as Prisma.InputJsonValue }),
        version: { increment: 1 },
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })

    if (result.count === 0) throw new OptimisticLockError()

    const record = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!record) throw new Error('Customer not found')

    await logAudit(tenantId, 'customer', id, 'UPDATE', data as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'customers')
    void embedSingleRecord(tenantId, 'customer', id)
    return record
  }

  async deleteCustomer(tenantId: string, id: string, actorId?: string) {
    await prisma.customer.deleteMany({ where: { id, tenantId } })
    await logAudit(tenantId, 'customer', id, 'DELETE', {}, actorId)
    await invalidateEntityCache(tenantId, 'customers')
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async listProducts(tenantId: string, opts: ListOptions = {}) {
    const { page = 1, limit = 20, search, sort = 'updatedAt', order = 'desc' } = opts
    const cacheKey = knowledgeCacheKey(tenantId, 'products', `list:${page}:${limit}:${search ?? ''}`)
    const cached = await cacheGet<{ data: unknown[]; total: number }>(cacheKey)
    if (cached) return cached

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sort]: order } }),
      prisma.product.count({ where }),
    ])

    const result = { data, total }
    await cacheSet(cacheKey, result)
    return result
  }

  async getProduct(tenantId: string, id: string) {
    return prisma.product.findFirst({ where: { id, tenantId } })
  }

  async createProduct(tenantId: string, input: ProductCreateInput, actorId?: string) {
    const content = buildProductContent(input)
    const sku = input.sku ?? `SKU-${Date.now()}`
    const slug =
      input.slug ??
      `${input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`
    const record = await prisma.product.create({
      data: {
        tenantId,
        name: input.name,
        sku,
        slug,
        catalog: input.catalog as Prisma.InputJsonValue,
        inventoryLevel: input.inventoryLevel,
        supplierInfo: input.supplierInfo as Prisma.InputJsonValue,
        pricingHistory: input.pricingHistory as Prisma.InputJsonValue,
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })
    await logAudit(tenantId, 'product', record.id, 'CREATE', input as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'products')
    void embedSingleRecord(tenantId, 'product', record.id)
    return record
  }

  async updateProduct(tenantId: string, id: string, input: ProductUpdateInput, actorId?: string) {
    const { version, ...data } = input
    const content = buildProductContent(data as ProductCreateInput)

    const result = await prisma.product.updateMany({
      where: { id, tenantId, version },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.catalog !== undefined && { catalog: data.catalog as Prisma.InputJsonValue }),
        ...(data.inventoryLevel !== undefined && { inventoryLevel: data.inventoryLevel }),
        ...(data.supplierInfo !== undefined && { supplierInfo: data.supplierInfo as Prisma.InputJsonValue }),
        ...(data.pricingHistory !== undefined && { pricingHistory: data.pricingHistory as Prisma.InputJsonValue }),
        version: { increment: 1 },
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })

    if (result.count === 0) throw new OptimisticLockError()
    const record = await prisma.product.findFirst({ where: { id, tenantId } })
    await logAudit(tenantId, 'product', id, 'UPDATE', data as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'products')
    void embedSingleRecord(tenantId, 'product', id)
    return record
  }

  async deleteProduct(tenantId: string, id: string, actorId?: string) {
    await prisma.product.deleteMany({ where: { id, tenantId } })
    await logAudit(tenantId, 'product', id, 'DELETE', {}, actorId)
    await invalidateEntityCache(tenantId, 'products')
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────

  async listSuppliers(tenantId: string, opts: ListOptions = {}) {
    const { page = 1, limit = 20, search, sort = 'updatedAt', order = 'desc' } = opts
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sort]: order } }),
      prisma.supplier.count({ where }),
    ])

    return { data, total }
  }

  async getSupplier(tenantId: string, id: string) {
    return prisma.supplier.findFirst({ where: { id, tenantId } })
  }

  async createSupplier(tenantId: string, input: SupplierCreateInput, actorId?: string) {
    const content = buildSupplierContent(input)
    const record = await prisma.supplier.create({
      data: {
        tenantId,
        name: input.name,
        performanceScore: input.performanceScore,
        deliveryHistory: input.deliveryHistory as Prisma.InputJsonValue,
        reliabilityMetrics: input.reliabilityMetrics as Prisma.InputJsonValue,
        costTrends: input.costTrends as Prisma.InputJsonValue,
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })
    await logAudit(tenantId, 'supplier', record.id, 'CREATE', input as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'suppliers')
    void embedSingleRecord(tenantId, 'supplier', record.id)
    return record
  }

  async updateSupplier(tenantId: string, id: string, input: SupplierUpdateInput, actorId?: string) {
    const { version, ...data } = input
    const content = buildSupplierContent(data as SupplierCreateInput)

    const result = await prisma.supplier.updateMany({
      where: { id, tenantId, version },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.performanceScore !== undefined && { performanceScore: data.performanceScore }),
        ...(data.deliveryHistory !== undefined && { deliveryHistory: data.deliveryHistory as Prisma.InputJsonValue }),
        ...(data.reliabilityMetrics !== undefined && { reliabilityMetrics: data.reliabilityMetrics as Prisma.InputJsonValue }),
        ...(data.costTrends !== undefined && { costTrends: data.costTrends as Prisma.InputJsonValue }),
        version: { increment: 1 },
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })

    if (result.count === 0) throw new OptimisticLockError()
    const record = await prisma.supplier.findFirst({ where: { id, tenantId } })
    await logAudit(tenantId, 'supplier', id, 'UPDATE', data as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'suppliers')
    void embedSingleRecord(tenantId, 'supplier', id)
    return record
  }

  async deleteSupplier(tenantId: string, id: string, actorId?: string) {
    await prisma.supplier.deleteMany({ where: { id, tenantId } })
    await logAudit(tenantId, 'supplier', id, 'DELETE', {}, actorId)
    await invalidateEntityCache(tenantId, 'suppliers')
  }

  // ── Business Knowledge ─────────────────────────────────────────────────────

  async listKnowledge(tenantId: string, opts: ListOptions = {}) {
    const { page = 1, limit = 20, search, type, sort = 'updatedAt', order = 'desc' } = opts
    const where: Prisma.BusinessKnowledgeWhereInput = {
      tenantId,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.businessKnowledge.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { [sort]: order } }),
      prisma.businessKnowledge.count({ where }),
    ])

    return { data, total }
  }

  async getKnowledge(tenantId: string, id: string) {
    return prisma.businessKnowledge.findFirst({ where: { id, tenantId } })
  }

  async createKnowledge(tenantId: string, input: KnowledgeCreateInput, actorId?: string) {
    const title = sanitizePostgresText(input.title)
    const content = sanitizePostgresText(input.content)
    const normalizedInput = { ...input, title, content }
    const embeddingContent = buildKnowledgeContent(normalizedInput)
    const record = await prisma.businessKnowledge.create({
      data: {
        tenantId,
        type: input.type,
        title,
        content,
        metadata: input.metadata as Prisma.InputJsonValue,
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(embeddingContent),
      },
    })
    await logAudit(tenantId, 'knowledge', record.id, 'CREATE', normalizedInput as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'knowledge')
    void embedSingleRecord(tenantId, 'knowledge', record.id)
    return record
  }

  async updateKnowledge(tenantId: string, id: string, input: KnowledgeUpdateInput, actorId?: string) {
    const { version, ...data } = input
    const content = buildKnowledgeContent(data as KnowledgeCreateInput)

    const result = await prisma.businessKnowledge.updateMany({
      where: { id, tenantId, version },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.metadata !== undefined && { metadata: data.metadata as Prisma.InputJsonValue }),
        version: { increment: 1 },
        embeddingStatus: EmbeddingStatus.PENDING,
        embeddingContentHash: hashEmbeddingContent(content),
      },
    })

    if (result.count === 0) throw new OptimisticLockError()
    const record = await prisma.businessKnowledge.findFirst({ where: { id, tenantId } })
    await logAudit(tenantId, 'knowledge', id, 'UPDATE', data as Record<string, unknown>, actorId)
    await invalidateEntityCache(tenantId, 'knowledge')
    void embedSingleRecord(tenantId, 'knowledge', id)
    return record
  }

  async deleteKnowledge(tenantId: string, id: string, actorId?: string) {
    await prisma.businessKnowledge.deleteMany({ where: { id, tenantId } })
    await logAudit(tenantId, 'knowledge', id, 'DELETE', {}, actorId)
    await invalidateEntityCache(tenantId, 'knowledge')
  }

  // ── Search & Audit ─────────────────────────────────────────────────────────

  async search(tenantId: string, query: string, entityType?: 'customer' | 'product' | 'supplier' | 'knowledge' | 'all', topK = 10) {
    return semanticSearch({ tenantId, query, entityType, topK })
  }

  async getAuditLog(tenantId: string, entityType: string, entityId: string) {
    return prisma.knowledgeAuditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }
}

export const knowledgeRepository = new KnowledgeRepository()
