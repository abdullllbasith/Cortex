import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis as UpstashRedis } from '@upstash/redis'

/** Edge-safe rate limiting for middleware — no Prisma/ioredis imports */
let upstashGlobal: Ratelimit | null = null
let upstashAuth: Ratelimit | null = null

function getUpstashLimiter(type: 'global' | 'auth'): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null

  const redis = new UpstashRedis({ url, token })
  if (type === 'global') {
    if (!upstashGlobal) {
      upstashGlobal = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000, '1 m'),
        prefix: 'saios:rl:global',
      })
    }
    return upstashGlobal
  }
  if (!upstashAuth) {
    upstashAuth = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'saios:rl:auth',
    })
  }
  return upstashAuth
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function classifyRateLimitRoute(pathname: string): 'global' | 'auth' | null {
  if (pathname.startsWith('/api/auth')) return 'auth'
  if (pathname.startsWith('/api/')) return 'global'
  return null
}

export async function applyEdgeRateLimit(
  request: NextRequest,
  type: 'global' | 'auth',
): Promise<NextResponse | null> {
  const limiter = getUpstashLimiter(type)
  if (!limiter) return null

  const ip = getClientIp(request)
  const key = type === 'auth' ? `auth:${ip}` : ip
  const { success, limit, remaining, reset } = await limiter.limit(key)

  if (!success) {
    return new NextResponse(
      JSON.stringify({ success: false, error: { message: 'Rate limit exceeded' } }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
        },
      },
    )
  }

  return null
}
