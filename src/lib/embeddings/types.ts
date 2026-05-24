import { createHash } from 'crypto'

export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_MODEL = 'text-embedding-3-large'
export const MAX_BATCH_SIZE = 100

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
