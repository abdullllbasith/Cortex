import { SignJWT, jwtVerify } from 'jose'
import type { AdminRole } from '@prisma/client'

const ADMIN_ACCESS_TTL_SECONDS = 8 * 60 * 60 // 8 hours

export const ADMIN_TOKEN_COOKIE = 'saios_admin_token'

export interface AdminAccessTokenPayload {
  sub: string
  supabaseId: string
  email: string
  fullName: string
  role: AdminRole
  isSuperAdmin: true
  tokenType: 'admin'
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signAdminAccessToken(
  payload: Omit<AdminAccessTokenPayload, 'tokenType' | 'isSuperAdmin'>,
): Promise<string> {
  return new SignJWT({
    supabaseId: payload.supabaseId,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.role,
    isSuperAdmin: true,
    tokenType: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_ACCESS_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyAdminAccessToken(token: string): Promise<AdminAccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  if (payload.tokenType !== 'admin' && payload.isSuperAdmin !== true) {
    throw new Error('Invalid admin token')
  }

  return {
    sub: payload.sub as string,
    supabaseId: (payload.supabaseId as string) ?? (payload.sub as string),
    email: payload.email as string,
    fullName: (payload.fullName as string) ?? 'Platform Admin',
    role: (payload.role as AdminRole) ?? 'SUPER_ADMIN',
    isSuperAdmin: true,
    tokenType: 'admin',
  }
}

export const ADMIN_ACCESS_TTL = ADMIN_ACCESS_TTL_SECONDS
