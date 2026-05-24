import Redis from 'ioredis'

let cacheClient: Redis | null = null
let bullmqClient: Redis | null = null
let redisDisabled = false
let warned = false

function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL?.trim()
  return Boolean(url) && !redisDisabled
}

function markDisabledOnce(message?: string) {
  redisDisabled = true
  if (!warned) {
    warned = true
    console.warn(
      message ??
        '[redis] Connection unavailable — caching and background queues disabled. Start Redis locally, use Upstash, or leave REDIS_URL empty.',
    )
  }
}

function createClient(maxRetriesPerRequest: number | null): Redis {
  const client = new Redis(process.env.REDIS_URL!.trim(), {
    maxRetriesPerRequest,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 3_000,
    retryStrategy(times) {
      if (times > 2) {
        markDisabledOnce()
        return null
      }
      return Math.min(times * 200, 1_000)
    },
  })

  client.on('error', () => {
    markDisabledOnce()
  })

  return client
}

/** General-purpose Redis client for cache, rate limiting, pub/sub */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null
  if (!cacheClient) cacheClient = createClient(3)
  return cacheClient
}

/** Dedicated connection for BullMQ (requires maxRetriesPerRequest: null) */
export function getBullmqConnection(): Redis | null {
  if (!isRedisConfigured()) return null
  if (!bullmqClient) bullmqClient = createClient(null)
  return bullmqClient
}

const DEFAULT_TTL_SECONDS = 300 // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    markDisabledOnce()
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value))
  } catch {
    markDisabledOnce()
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const client = getRedis()
  if (!client || keys.length === 0) return

  try {
    await client.del(...keys)
  } catch {
    markDisabledOnce()
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    const keys = await client.keys(pattern)
    if (keys.length > 0) await client.del(...keys)
  } catch {
    markDisabledOnce()
  }
}

export function knowledgeCacheKey(tenantId: string, entity: string, suffix: string): string {
  return `saios:knowledge:${tenantId}:${entity}:${suffix}`
}
