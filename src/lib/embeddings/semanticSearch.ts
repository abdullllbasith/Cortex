import { prisma } from '@/lib/db/prisma'
import { generateEmbedding } from './embeddingService'
import { toVectorLiteral } from './types'
import type { KnowledgeEntityType } from './knowledgeIndexer'

export interface SemanticSearchParams {
  tenantId: string
  query: string
  entityType?: KnowledgeEntityType | 'all'
  topK?: number
}

export interface SemanticSearchResult {
  id: string
  entityType: KnowledgeEntityType
  title: string
  snippet: string
  similarity: number
  metadata?: Record<string, unknown>
  embeddingStatus?: string
}

const DEFAULT_TOP_K = 10

export function cosineSimilarityToScore(distance: number): number {
  return Math.max(0, 1 - distance)
}

async function searchCustomers(
  tenantId: string,
  vectorLiteral: string,
  topK: number,
): Promise<SemanticSearchResult[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    title: string | null
    distance: number
    embeddingStatus: string
  }>>`
    SELECT id,
           profile->>'name' AS title,
           (embedding <=> ${vectorLiteral}::vector) AS distance,
           "embeddingStatus"
    FROM customers
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    entityType: 'customer' as const,
    title: r.title ?? 'Customer',
    snippet: `Customer record ${r.id}`,
    similarity: cosineSimilarityToScore(Number(r.distance)),
    embeddingStatus: r.embeddingStatus,
  }))
}

async function searchProducts(
  tenantId: string,
  vectorLiteral: string,
  topK: number,
): Promise<SemanticSearchResult[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    name: string
    catalog: unknown
    distance: number
    embeddingStatus: string
  }>>`
    SELECT id, name, catalog,
           (embedding <=> ${vectorLiteral}::vector) AS distance,
           "embeddingStatus"
    FROM products
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    entityType: 'product' as const,
    title: r.name,
    snippet: (r.catalog as Record<string, unknown>)?.description as string ?? r.name,
    similarity: cosineSimilarityToScore(Number(r.distance)),
    embeddingStatus: r.embeddingStatus,
  }))
}

async function searchSuppliers(
  tenantId: string,
  vectorLiteral: string,
  topK: number,
): Promise<SemanticSearchResult[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    name: string
    performanceScore: number
    distance: number
    embeddingStatus: string
  }>>`
    SELECT id, name, "performanceScore",
           (embedding <=> ${vectorLiteral}::vector) AS distance,
           "embeddingStatus"
    FROM suppliers
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    entityType: 'supplier' as const,
    title: r.name,
    snippet: `Performance score: ${r.performanceScore}`,
    similarity: cosineSimilarityToScore(Number(r.distance)),
    embeddingStatus: r.embeddingStatus,
  }))
}

async function searchContacts(
  tenantId: string,
  vectorLiteral: string,
  topK: number,
): Promise<SemanticSearchResult[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    firstName: string
    lastName: string
    email: string | null
    company: string | null
    distance: number
    embeddingStatus: string
  }>>`
    SELECT id, "firstName", "lastName", email, company,
           (embedding <=> ${vectorLiteral}::vector) AS distance,
           "embeddingStatus"
    FROM crm_contacts
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL AND "isActive" = true
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    entityType: 'contact' as const,
    title: `${r.firstName} ${r.lastName}`.trim(),
    snippet: [r.email, r.company].filter(Boolean).join(' · ') || 'CRM contact',
    similarity: cosineSimilarityToScore(Number(r.distance)),
    embeddingStatus: r.embeddingStatus,
  }))
}

async function searchKnowledge(
  tenantId: string,
  vectorLiteral: string,
  topK: number,
): Promise<SemanticSearchResult[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    title: string
    content: string
    type: string
    metadata: unknown
    distance: number
    embeddingStatus: string
  }>>`
    SELECT id, title, content, type, metadata,
           (embedding <=> ${vectorLiteral}::vector) AS distance,
           "embeddingStatus"
    FROM business_knowledge
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    entityType: 'knowledge' as const,
    title: r.title,
    snippet: r.content.slice(0, 200),
    similarity: cosineSimilarityToScore(Number(r.distance)),
    metadata: { type: r.type, ...(r.metadata as Record<string, unknown>) },
    embeddingStatus: r.embeddingStatus,
  }))
}

export async function semanticSearch(params: SemanticSearchParams): Promise<SemanticSearchResult[]> {
  const { tenantId, query, entityType = 'all', topK = DEFAULT_TOP_K } = params
  if (!query.trim()) return []

  const embedding = await generateEmbedding(query)
  const vectorLiteral = toVectorLiteral(embedding)
  const results: SemanticSearchResult[] = []

  if (entityType === 'all' || entityType === 'customer') {
    results.push(...await searchCustomers(tenantId, vectorLiteral, topK))
  }
  if (entityType === 'all' || entityType === 'product') {
    results.push(...await searchProducts(tenantId, vectorLiteral, topK))
  }
  if (entityType === 'all' || entityType === 'supplier') {
    results.push(...await searchSuppliers(tenantId, vectorLiteral, topK))
  }
  if (entityType === 'all' || entityType === 'knowledge') {
    results.push(...await searchKnowledge(tenantId, vectorLiteral, topK))
  }
  if (entityType === 'all' || entityType === 'contact') {
    results.push(...await searchContacts(tenantId, vectorLiteral, topK))
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
}

export async function findSimilarEntities(
  tenantId: string,
  entityType: KnowledgeEntityType,
  entityId: string,
  topK = 5,
): Promise<SemanticSearchResult[]> {
  const params: SemanticSearchParams = {
    tenantId,
    query: '',
    entityType,
    topK: topK + 1,
  }

  // Use the record's own content as query proxy via direct vector lookup
  const tableMap = {
    customer: 'customers',
    product: 'products',
    supplier: 'suppliers',
    knowledge: 'business_knowledge',
  } as const

  const table = tableMap[entityType]

  const source = await prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
    `SELECT embedding::text AS embedding FROM ${table} WHERE id = $1 AND "tenantId" = $2`,
    entityId,
    tenantId,
  )

  if (!source[0]?.embedding) return []

  const vectorLiteral = source[0].embedding.replace(/[\[\]]/g, (m) => m)

  const searchFn = {
    customer: () => searchCustomers(tenantId, vectorLiteral, topK + 1),
    product: () => searchProducts(tenantId, vectorLiteral, topK + 1),
    supplier: () => searchSuppliers(tenantId, vectorLiteral, topK + 1),
    knowledge: () => searchKnowledge(tenantId, vectorLiteral, topK + 1),
  }[entityType]

  return (await searchFn()).filter((r) => r.id !== entityId).slice(0, topK)
}
