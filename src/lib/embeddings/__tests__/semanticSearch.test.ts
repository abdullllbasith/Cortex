/** @jest-environment node */
import { cosineSimilarityToScore } from '@/lib/embeddings/semanticSearch'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}))

jest.mock('@/lib/embeddings/embeddingService', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(2048).fill(0.1)),
}))

import { semanticSearch } from '@/lib/embeddings/semanticSearch'
import { prisma } from '@/lib/db/prisma'
import { generateEmbedding } from '@/lib/embeddings/embeddingService'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockGenerateEmbedding = generateEmbedding as jest.MockedFunction<typeof generateEmbedding>

describe('cosineSimilarityToScore', () => {
  it('returns 1 for zero distance (identical vectors)', () => {
    expect(cosineSimilarityToScore(0)).toBe(1)
  })

  it('returns 0 for distance >= 1', () => {
    expect(cosineSimilarityToScore(1)).toBe(0)
    expect(cosineSimilarityToScore(1.5)).toBe(0)
  })

  it('returns intermediate score for partial similarity', () => {
    expect(cosineSimilarityToScore(0.2)).toBeCloseTo(0.8)
  })
})

describe('semanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array for blank query', async () => {
    const results = await semanticSearch({ tenantId: 'tenant-1', query: '   ' })
    expect(results).toEqual([])
    expect(mockGenerateEmbedding).not.toHaveBeenCalled()
  })

  it('generates embedding and searches all entity types', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'c1', title: 'Sarah Chen', distance: 0.1, embeddingStatus: 'INDEXED' }])
      .mockResolvedValueOnce([{ id: 'p1', name: 'Widget', catalog: { description: 'A widget' }, distance: 0.2, embeddingStatus: 'INDEXED' }])
      .mockResolvedValueOnce([{ id: 's1', name: 'TechParts', performanceScore: 92, distance: 0.15, embeddingStatus: 'INDEXED' }])
      .mockResolvedValueOnce([{ id: 'k1', title: 'Policy', content: 'Data policy text', type: 'POLICY', metadata: {}, distance: 0.05, embeddingStatus: 'INDEXED' }])

    const results = await semanticSearch({
      tenantId: 'tenant-1',
      query: 'enterprise analytics customer',
      entityType: 'all',
      topK: 10,
    })

    expect(mockGenerateEmbedding).toHaveBeenCalledWith('enterprise analytics customer')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].similarity).toBeGreaterThan(results[results.length - 1].similarity)
  })

  it('filters by entity type when specified', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { id: 'p1', name: 'Sensor Kit', catalog: {}, distance: 0.1, embeddingStatus: 'INDEXED' },
    ])

    const results = await semanticSearch({
      tenantId: 'tenant-1',
      query: 'sensor hardware',
      entityType: 'product',
      topK: 5,
    })

    expect(results).toHaveLength(1)
    expect(results[0].entityType).toBe('product')
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('respects topK limit after merging results', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      title: `Customer ${i}`,
      distance: i * 0.1,
      embeddingStatus: 'INDEXED',
    }))

    mockPrisma.$queryRaw.mockResolvedValueOnce(items)

    const results = await semanticSearch({
      tenantId: 'tenant-1',
      query: 'customer',
      entityType: 'customer',
      topK: 3,
    })

    expect(results.length).toBeLessThanOrEqual(3)
  })
})
