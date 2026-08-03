import { createHash } from 'crypto'

/** OpenRouter free RAG embedder — nvidia/nemotron-3-embed-1b:free (native 2048 dims). */
export const EMBEDDING_DIMENSIONS = 2048
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL?.trim() || 'nvidia/nemotron-3-embed-1b:free'
export const MAX_BATCH_SIZE = 100

/** OpenAI-style models that accept a `dimensions` request field. */
export function embeddingSupportsDimensionsParam(model: string): boolean {
  return /text-embedding-3/i.test(model)
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

/** Deterministic content hash for incremental embedding updates. */
export function hashEmbeddingContent(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex')
}

/** Format a number[] as a pgvector literal string. */
export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingError(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`,
      'INVALID_DIMENSIONS',
    )
  }
  return `[${vector.join(',')}]`
}
