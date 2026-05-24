import { Ratelimit } from '@upstash/ratelimit'
import { Redis as UpstashRedis } from '@upstash/redis'
import { getRedis } from '@/lib/cache/redis'

const LIMIT = 60
const WINDOW_SECONDS = 60

let upstashRatelimit: Ratelimit | null = null

function getUpstashRatelimit(): Ratelimit | null {
  if (upstashRatelimit) return upstashRatelimit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const redis = new UpstashRedis({ url, token })
  upstashRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(LIMIT, `${WINDOW_SECONDS} s`),
    prefix: 'saios:assistant:ratelimit',
  })
  return upstashRatelimit
}

async function checkWithIoredis(userId: string): Promise<{ success: boolean; retryAfter: number }> {
  const client = getRedis()
  if (!client) {
    return { success: true, retryAfter: 0 }
  }

  const key = `saios:assistant:ratelimit:${userId}`
  try {
    const count = await client.incr(key)
    if (count === 1) {
      await client.expire(key, WINDOW_SECONDS)
    }
    if (count > LIMIT) {
      const ttl = await client.ttl(key)
      return { success: false, retryAfter: Math.max(ttl, 1) }
    }
    return { success: true, retryAfter: 0 }
  } catch {
    return { success: true, retryAfter: 0 }
  }
}

export async function checkAssistantRateLimit(
  userId: string,
): Promise<{ allowed: boolean; retryAfter: number; remaining?: number }> {
  const upstash = getUpstashRatelimit()

  if (upstash) {
    try {
      const result = await upstash.limit(userId)
      return {
        allowed: result.success,
        retryAfter: result.success ? 0 : Math.ceil((result.reset - Date.now()) / 1000),
        remaining: result.remaining,
      }
    } catch (err) {
      console.warn('[rateLimiter] Upstash failed, falling back to ioredis', err)
    }
  }

  const fallback = await checkWithIoredis(userId)
  return {
    allowed: fallback.success,
    retryAfter: fallback.retryAfter,
  }
}
