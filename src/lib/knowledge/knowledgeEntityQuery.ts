import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import {
  listKnowledgeProducts,
  listKnowledgeSuppliers,
  type KnowledgeProductFilters,
  type KnowledgeSupplierFilters,
} from '@/lib/knowledge/knowledgeProductSupplierService'
import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import { classifyStock } from '@/lib/inventory/inventoryDashboardService'
import { prisma } from '@/lib/db/prisma'
import { performanceScoreToStars } from '@/lib/knowledge/supplierPerformanceService'

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : value.toNumber()
}

export async function queryKnowledgeEntities(
  tenantId: string,
  type: 'product' | 'supplier',
  options: {
    search?: string
    page?: number
    limit?: number
    semantic?: boolean
    productFilters?: KnowledgeProductFilters
    supplierFilters?: KnowledgeSupplierFilters
  },
) {
  const page = options.page ?? 1
  const limit = options.limit ?? 20
  const search = options.search?.trim()
  const useSemantic = options.semantic ?? (search != null && search.length >= 2)

  if (useSemantic && search) {
    const results = await semanticSearch({
      tenantId,
      query: search,
      entityType: type,
      topK: Math.min(limit, 50),
    })

    if (type === 'product') {
      const ids = results.map((r) => r.id)
      const rows = ids.length
        ? await prisma.product.findMany({
            where: { tenantId, id: { in: ids } },
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              stockBalances: { select: { quantityOnHand: true } },
            },
          })
        : []
      const rowMap = new Map(rows.map((p) => [p.id, p]))
      const data = results
        .map((r) => {
          const p = rowMap.get(r.id)
          if (!p) {
            return {
              id: r.id,
              sku: String(r.metadata?.sku ?? '—'),
              name: r.title,
              imageUrls: [] as string[],
              category: null,
              supplier: null,
              costPrice: 0,
              sellingPrice: 0,
              onHand: 0,
              stockHealth: 'in_stock' as const,
              embeddingStatus: r.embeddingStatus,
              updatedAt: new Date().toISOString(),
              similarity: r.similarity,
            }
          }
          const onHand = p.stockBalances.reduce((s, b) => s + toNumber(b.quantityOnHand), 0)
          const reorderPoint = toNumber(p.reorderPoint)
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            imageUrls: p.imageUrls ?? [],
            category: p.category,
            supplier: p.supplier,
            costPrice: toNumber(p.costPrice),
            sellingPrice: toNumber(p.sellingPrice),
            onHand,
            stockHealth: classifyStock(onHand, reorderPoint),
            embeddingStatus: p.embeddingStatus,
            updatedAt: p.updatedAt.toISOString(),
            similarity: r.similarity,
          }
        })
        .filter(Boolean)

      return { data, total: data.length, page: 1, limit, semantic: true }
    }

    const listed = await listKnowledgeSuppliers(tenantId, { limit: 100 })
    const supplierMap = new Map(listed.data.map((s) => [s.id, s]))
    const data = results.map((r) => {
      const s = supplierMap.get(r.id)
      return {
        ...(s ?? {
          id: r.id,
          name: r.title,
          code: '—',
          type: 'DISTRIBUTOR',
          contactEmail: '—',
          reliabilityStars: performanceScoreToStars(
            typeof r.metadata?.performanceScore === 'number' ? r.metadata.performanceScore : null,
          ),
          performanceScore: null,
          activePoCount: 0,
          paymentTerms: 'NET30',
          lastOrderAt: null,
          isActive: true,
          updatedAt: new Date().toISOString(),
        }),
        embeddingStatus: r.embeddingStatus ?? s?.embeddingStatus,
        similarity: r.similarity,
      }
    })

    return { data, total: data.length, page: 1, limit, semantic: true }
  }

  if (type === 'product') {
    return { ...(await listKnowledgeProducts(tenantId, { page, limit, ...options.productFilters, search })), semantic: false }
  }

  return { ...(await listKnowledgeSuppliers(tenantId, { page, limit, ...options.supplierFilters, search })), semantic: false }
}

/** Documents / generic knowledge list (existing behavior). */
export async function queryKnowledgeDocuments(
  tenantId: string,
  options: { page?: number; limit?: number; search?: string; type?: Parameters<typeof knowledgeRepository.listKnowledge>[1]['type'] },
) {
  return knowledgeRepository.listKnowledge(tenantId, options)
}
