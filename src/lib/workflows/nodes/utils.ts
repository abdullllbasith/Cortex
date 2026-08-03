import { z } from 'zod'

export function validateConfig<T>(schema: z.ZodType<T>, config: unknown, nodeType: string): T {
  const result = schema.safeParse(config)
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid config for ${nodeType}: ${msg}`)
  }
  return result.data
}

export function nodeError(nodeType: string, message: string): Error {
  return new Error(`[${nodeType}] ${message}`)
}
