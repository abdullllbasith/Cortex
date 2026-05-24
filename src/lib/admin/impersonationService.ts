import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logAdminAction } from '@/middleware/adminAuth'

export const IMPERSONATION_COOKIE = 'saios_impersonation'
export const IMPERSONATION_TTL_SECONDS = 2 * 60 * 60 // 2 hours

export interface ImpersonationPayload {
  tenantId: string
  tenantName: string
  adminId: string
  adminEmail: string
  isImpersonation: true
  sub: string
}

export interface ImpersonationSession {
  tenantId: string
  tenantName: string
  adminId: string
  adminEmail: string
  expiresAt: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return new TextEncoder().encode(secret)
}

export async function createImpersonationToken(
  adminId: string,
  adminEmail: string,
  targetTenantId: string,
): Promise<{ token: string; session: ImpersonationSession }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { id: true, name: true },
  })
  if (!tenant) throw new Error('Tenant not found')

  const owner = await prisma.user.findFirst({
    where: { tenantId: targetTenantId, role: 'OWNER', isActive: true },
    select: { id: true },
  })

  const impersonationUserId = owner?.id ?? `impersonation:${adminId}`
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000)

  const token = await new SignJWT({
    tenantId: tenant.id,
    tenantName: tenant.name,
    adminId,
    adminEmail,
    isImpersonation: true,
    userId: impersonationUserId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(impersonationUserId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  await logAdminAction(adminId, 'IMPERSONATE_START', {
    targetType: 'tenant',
    targetId: tenant.id,
    details: { tenantName: tenant.name, isImpersonation: true },
  })

  return {
    token,
    session: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminId,
      adminEmail,
      expiresAt: expiresAt.toISOString(),
    },
  }
}

export async function verifyImpersonationToken(
  token: string,
): Promise<ImpersonationPayload | null> {
  try {
    const verified = await jwtVerify(token, getSecret())
    const payload = verified.payload as Record<string, unknown>
    if (payload.isImpersonation !== true) return null

    const tenantId = payload.tenantId as string
    const adminId = payload.adminId as string
    if (!tenantId || !adminId) return null

    return {
      tenantId,
      tenantName: (payload.tenantName as string) ?? 'Workspace',
      adminId,
      adminEmail: (payload.adminEmail as string) ?? 'admin',
      isImpersonation: true,
      sub: verified.payload.sub as string,
    }
  } catch {
    return null
  }
}

export function getImpersonationTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(IMPERSONATION_COOKIE)?.value
  if (cookie) return cookie
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (!token.startsWith('sk_saios_')) return token
  }
  return null
}

export async function getImpersonationSession(
  request: NextRequest,
): Promise<ImpersonationSession | null> {
  const token = getImpersonationTokenFromRequest(request)
  if (!token) return null
  const payload = await verifyImpersonationToken(token)
  if (!payload) return null
  return {
    tenantId: payload.tenantId,
    tenantName: payload.tenantName,
    adminId: payload.adminId,
    adminEmail: payload.adminEmail,
    expiresAt: new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000).toISOString(),
  }
}

export function setImpersonationCookie(response: NextResponse, token: string): void {
  response.cookies.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: IMPERSONATION_TTL_SECONDS,
  })
}

export function clearImpersonationCookie(response: NextResponse): void {
  response.cookies.set(IMPERSONATION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function endImpersonation(
  request: NextRequest,
  response: NextResponse,
): Promise<{ ended: boolean; adminId?: string }> {
  const token = getImpersonationTokenFromRequest(request)
  if (!token) {
    clearImpersonationCookie(response)
    return { ended: true }
  }

  const payload = await verifyImpersonationToken(token)
  clearImpersonationCookie(response)

  if (payload) {
    await logAdminAction(payload.adminId, 'IMPERSONATE_END', {
      targetType: 'tenant',
      targetId: payload.tenantId,
      details: { tenantName: payload.tenantName, isImpersonation: true },
    })
    return { ended: true, adminId: payload.adminId }
  }

  return { ended: true }
}

export async function logImpersonationAction(
  payload: ImpersonationPayload,
  action: string,
  request: NextRequest,
  details?: Record<string, unknown>,
): Promise<void> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')

  await logAdminAction(payload.adminId, action, {
    targetType: 'tenant',
    targetId: payload.tenantId,
    ipAddress: ip,
    details: {
      ...details,
      isImpersonation: true,
      tenantName: payload.tenantName,
      path: request.nextUrl.pathname,
      method: request.method,
    },
  })
}
