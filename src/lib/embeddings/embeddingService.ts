import OpenAI from 'openai'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingError,
} from './types'

let openaiClient: OpenAI | null = null

const EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000
const EMBEDDING_CACHE_MAX = 200
const embeddingCache = new Map<string, { vector: number[]; at: number }>()

function cacheKey(text: string): string {
  return text.trim().toLowerCase()
}

function readEmbeddingCache(text: string): number[] | null {
  const key = cacheKey(text)
  const hit = embeddingCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > EMBEDDING_CACHE_TTL_MS) {
    embeddingCache.delete(key)
    return null
  }
  return hit.vector
}

function writeEmbeddingCache(text: string, vector: number[]) {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value
    if (oldest) embeddingCache.delete(oldest)
  }
  embeddingCache.set(cacheKey(text), { vector, at: Date.now() })
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new EmbeddingError('OPENAI_API_KEY is not configured', 'MISSING_API_KEY')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/** Generate a mock embedding for dev/test when OpenAI is unavailable. */
function mockEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  for (let i = 0; i < text.length; i++) {
    vector[i % EMBEDDING_DIMENSIONS] += text.charCodeAt(i) / 255
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map((v) => v / magnitude)
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Accepts text and returns a 1536-dimension vector via OpenAI text-embedding-3-large.
 * Handles rate limits with exponential backoff (max 3 retries).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim()
  if (!input) {
    throw new EmbeddingError('Cannot embed empty text', 'EMPTY_INPUT')
  }

  const cached = readEmbeddingCache(input)
  if (cached) return cached

  if (process.env.AUTH_DEV_MODE === 'true' && !process.env.OPENAI_API_KEY) {
    const vector = mockEmbedding(input)
    writeEmbeddingCache(input, vector)
    return vector
  }

  const client = getOpenAIClient()
  let attempt = 0
  const maxAttempts = 3

  while (attempt < maxAttempts) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      const embedding = response.data[0]?.embedding
      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingError('Invalid embedding response from OpenAI', 'INVALID_RESPONSE')
      }

      writeEmbeddingCache(input, embedding)
      return embedding
    } catch (err: unknown) {
      attempt++

      const isRateLimit =
        err instanceof OpenAI.APIError &&
        (err.status === 429 || err.code === 'rate_limit_exceeded')

      if (isRateLimit && attempt < maxAttempts) {
        const retryAfterMs = Math.pow(2, attempt) * 1000
        await sleep(retryAfterMs)
        continue
      }

      if (err instanceof EmbeddingError) throw err

      const message = err instanceof Error ? err.message : 'Embedding generation failed'
      throw new EmbeddingError(message, 'EMBEDDING_FAILED')
    }
  }

  throw new EmbeddingError('Max embedding retries exceeded', 'MAX_RETRIES')
}

/** Batch embed up to 100 texts per OpenAI request. */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  if (texts.length > 100) {
    throw new EmbeddingError('Batch size exceeds maximum of 100', 'BATCH_TOO_LARGE')
  }

  if (process.env.AUTH_DEV_MODE === 'true' && !process.env.OPENAI_API_KEY) {
    return texts.map(mockEmbedding)
  }

  const client = getOpenAIClient()
  let attempt = 0

  while (attempt < 3) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts.map((t) => t.trim()),
        dimensions: EMBEDDING_DIMENSIONS,
      })

      return response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding)
    } catch (err: unknown) {
      attempt++
      const isRateLimit = err instanceof OpenAI.APIError && err.status === 429
      if (isRateLimit && attempt < 3) {
        await sleep(Math.pow(2, attempt) * 1000)
        continue
      }
      const message = err instanceof Error ? err.message : 'Batch embedding failed'
      throw new EmbeddingError(message, 'BATCH_EMBEDDING_FAILED')
    }
  }

  throw new EmbeddingError('Batch embedding max retries exceeded', 'MAX_RETRIES')
}
