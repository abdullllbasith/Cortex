import { SignJWT, jwtVerify } from 'jose'
import type { Permission } from '@/lib/auth/permissions'

const ACCESS_TTL_SECONDS = 15 * 60 // 15 minutes
export const REFRESH_TTL_DAYS = 30
export const REFRESH_TTL_SESSION_DAYS = 1 // when "Remember me" is unchecked

export interface AccessTokenPayload {
  sub: string
  tenantId: string
  role: string
  permissions: Permission[]
  mfaPending?: boolean
  sessionId?: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    permissions: payload.permissions,
    mfaPending: payload.mfaPending ?? false,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    sub: payload.sub as string,
    tenantId: payload.tenantId as string,
    role: payload.role as string,
    permissions: (payload.permissions as Permission[]) ?? [],
    mfaPending: Boolean(payload.mfaPending),
    sessionId: payload.sessionId as string | undefined,
  }
}

export function refreshTokenExpiresAt(rememberMe = true): Date {
  const d = new Date()
  d.setDate(d.getDate() + (rememberMe ? REFRESH_TTL_DAYS : REFRESH_TTL_SESSION_DAYS))
  return d
}

export function refreshCookieMaxAge(rememberMe = true): number {
  const days = rememberMe ? REFRESH_TTL_DAYS : REFRESH_TTL_SESSION_DAYS
  return days * 24 * 60 * 60
}

export const REFRESH_COOKIE = 'saios_refresh'
export const ACCESS_TTL = ACCESS_TTL_SECONDS
