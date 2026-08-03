import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis as UpstashRedis } from '@upstash/redis'
import { getRedis } from '@/lib/cache/redis'
import { prisma } from '@/lib/db/prisma'

type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

const AI_LIMITS: Record<PlanTier, number> = {
  STARTER: 60,
  PROFESSIONAL: 300,
  ENTERPRISE: 1_000_000,
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

let upstashGlobal: Ratelimit | null = null
let upstashAuth: Ratelimit | null = null

function getUpstashLimiter(type: 'global' | 'auth'): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
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

async function ioredisRateLimit(key: string, limit: number, windowSec: number): Promise<{
  allowed: boolean
  remaining: number
  reset: number
}> {
  const client = getRedis()
  if (!client) return { allowed: true, remaining: limit, reset: Date.now() + windowSec * 1000 }

  const bucket = `saios:rl:${key}`
  const count = await client.incr(bucket)
  if (count === 1) await client.expire(bucket, windowSec)
  const ttl = await client.ttl(bucket)
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    reset: Date.now() + ttl * 1000,
  }
}

function rateLimitHeaders(limit: number, remaining: number, reset: number): HeadersInit {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
  }
}

export async function applyRateLimit(
  request: NextRequest,
  type: 'global' | 'auth' | 'ai',
  tenantId?: string,
): Promise<NextResponse | null> {
  const ip = getClientIp(request)

  if (type === 'global') {
    const limiter = getUpstashLimiter('global')
    if (limiter) {
      const { success, limit, remaining, reset } = await limiter.limit(ip)
      if (!success) {
        return new NextResponse(JSON.stringify({ success: false, error: { message: 'Rate limit exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(limit, remaining, reset) },
        })
      }
      return null
    }
    const r = await ioredisRateLimit(`global:${ip}`, 1000, 60)
    if (!r.allowed) {
      return new NextResponse(JSON.stringify({ success: false, error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(1000, r.remaining, r.reset) },
      })
    }
    return null
  }

  if (type === 'auth') {
    const limiter = getUpstashLimiter('auth')
    if (limiter) {
      const { success, limit, remaining, reset } = await limiter.limit(`auth:${ip}`)
      if (!success) {
        return new NextResponse(JSON.stringify({ success: false, error: { message: 'Too many auth attempts' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(limit, remaining, reset) },
        })
      }
      return null
    }
    const r = await ioredisRateLimit(`auth:${ip}`, 10, 60)
    if (!r.allowed) {
      return new NextResponse(JSON.stringify({ success: false, error: { message: 'Too many auth attempts' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(10, r.remaining, r.reset) },
      })
    }
    return null
  }

  if (type === 'ai' && tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } })
    const plan = (tenant?.plan ?? 'STARTER') as PlanTier
    const limit = AI_LIMITS[plan] ?? 60
    if (plan === 'ENTERPRISE') return null

    const r = await ioredisRateLimit(`ai:${tenantId}`, limit, 60)
    if (!r.allowed) {
      return new NextResponse(JSON.stringify({ success: false, error: { message: 'AI rate limit exceeded for plan' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(limit, r.remaining, r.reset) },
      })
    }
  }

  return null
}

export function classifyRateLimitRoute(pathname: string): 'global' | 'auth' | 'ai' | null {
  if (pathname.startsWith('/api/auth')) return 'auth'
  if (pathname.startsWith('/api/assistant') || pathname.startsWith('/api/agents')) return 'ai'
  if (pathname.startsWith('/api/')) return 'global'
  return null
}
