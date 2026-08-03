import OpenAI from 'openai'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EmbeddingError,
  embeddingSupportsDimensionsParam,
} from './types'

let embeddingClient: OpenAI | null = null

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

function resolveEmbeddingApiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  )
}

function resolveEmbeddingBaseUrl(): string | undefined {
  const explicit = process.env.LLM_BASE_URL?.trim() || process.env.OPENROUTER_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.OPENROUTER_API_KEY?.trim() || process.env.LLM_API_KEY?.trim()) {
    return 'https://openrouter.ai/api/v1'
  }
  return undefined
}

function getEmbeddingClient(): OpenAI {
  if (!embeddingClient) {
    const apiKey = resolveEmbeddingApiKey()
    if (!apiKey) {
      throw new EmbeddingError(
        'Embedding API key not configured (set OPENROUTER_API_KEY)',
        'MISSING_API_KEY',
      )
    }
    const baseURL = resolveEmbeddingBaseUrl()
    embeddingClient = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      defaultHeaders: baseURL?.includes('openrouter.ai')
        ? {
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://cortex.app',
            'X-Title': 'Cortex',
          }
        : undefined,
    })
  }
  return embeddingClient
}

/** Generate a mock embedding for dev/test when no API key is available. */
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

function buildEmbeddingCreateParams(input: string | string[]) {
  const model = EMBEDDING_MODEL
  const params: OpenAI.Embeddings.EmbeddingCreateParams = {
    model,
    input,
    // Nvidia OpenRouter embeddings reject base64; always request floats.
    encoding_format: 'float',
  }
  // Only OpenAI text-embedding-3-* supports truncating via `dimensions`.
  if (embeddingSupportsDimensionsParam(model)) {
    params.dimensions = EMBEDDING_DIMENSIONS
  }
  return params
}

/**
 * Returns a 2048-dim vector via OpenRouter Nemotron 3 Embed 1B (free) by default.
 * Handles rate limits with exponential backoff (max 3 retries).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim()
  if (!input) {
    throw new EmbeddingError('Cannot embed empty text', 'EMPTY_INPUT')
  }

  const cached = readEmbeddingCache(input)
  if (cached) return cached

  if (process.env.AUTH_DEV_MODE === 'true' && !resolveEmbeddingApiKey()) {
    const vector = mockEmbedding(input)
    writeEmbeddingCache(input, vector)
    return vector
  }

  const client = getEmbeddingClient()
  let attempt = 0
  const maxAttempts = 3

  while (attempt < maxAttempts) {
    try {
      const response = await client.embeddings.create(buildEmbeddingCreateParams(input))

      const embedding = response.data[0]?.embedding
      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingError(
          `Invalid embedding response (got ${embedding?.length ?? 0} dims, expected ${EMBEDDING_DIMENSIONS})`,
          'INVALID_RESPONSE',
        )
      }

      writeEmbeddingCache(input, embedding)
      return embedding
    } catch (err: unknown) {
      attempt++

      const message = err instanceof Error ? err.message : 'Embedding generation failed'
      const isBillingExhausted =
        /no credits remaining|insufficient_quota|billing/i.test(message)
      if (isBillingExhausted) {
        throw new EmbeddingError(message, 'EMBEDDING_FAILED')
      }

      const isRateLimit =
        err instanceof OpenAI.APIError &&
        (err.status === 429 || err.code === 'rate_limit_exceeded')

      if (isRateLimit && attempt < maxAttempts) {
        const retryAfterMs = Math.pow(2, attempt) * 1000
        await sleep(retryAfterMs)
        continue
      }

      if (err instanceof EmbeddingError) throw err

      throw new EmbeddingError(message, 'EMBEDDING_FAILED')
    }
  }

  throw new EmbeddingError('Max embedding retries exceeded', 'MAX_RETRIES')
}

/** Batch embed up to 100 texts per request. */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  if (texts.length > 100) {
    throw new EmbeddingError('Batch size exceeds maximum of 100', 'BATCH_TOO_LARGE')
  }

  if (process.env.AUTH_DEV_MODE === 'true' && !resolveEmbeddingApiKey()) {
    return texts.map(mockEmbedding)
  }

  const client = getEmbeddingClient()
  let attempt = 0

  while (attempt < 3) {
    try {
      const response = await client.embeddings.create(
        buildEmbeddingCreateParams(texts.map((t) => t.trim())),
      )

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
