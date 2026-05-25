import { NextRequest } from 'next/server'
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth/adminJwt'

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

export function parseIpAllowlist(): string[] {
  const raw = process.env.ADMIN_IP_ALLOWLIST?.trim()
  if (!raw) return []
  return raw.split(',').map((ip) => ip.trim()).filter(Boolean)
}

export function checkIpAllowlist(ip: string | null): boolean {
  const allowlist = parseIpAllowlist()
  if (allowlist.length === 0) return true
  if (!ip) return false
  return allowlist.includes(ip) || allowlist.includes('*')
}

function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return request.cookies.get(ADMIN_TOKEN_COOKIE)?.value ?? null
}

export function getAdminTokenFromRequest(request: NextRequest): string | null {
  return getBearerToken(request)
}

export function isAdminApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/admin/')
}

export function isAdminPageRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function isAdminLoginRoute(pathname: string): boolean {
  return pathname === '/admin/login'
}
