import { NextRequest, NextResponse } from 'next/server'
import type { AdminRole, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { apiError } from '@/lib/knowledge/response'
import { ADMIN_TOKEN_COOKIE, verifyAdminAccessToken } from '@/lib/auth/adminJwt'
import {
  checkIpAllowlist,
  getAdminTokenFromRequest,
  getClientIp,
  isAdminApiRoute,
  isAdminLoginRoute,
  isAdminPageRoute,
} from '@/middleware/adminAuthEdge'

export {
  ADMIN_TOKEN_COOKIE,
  checkIpAllowlist,
  getAdminTokenFromRequest,
  getClientIp,
  isAdminApiRoute,
  isAdminLoginRoute,
  isAdminPageRoute,
}

export interface AdminAuthContext {
  adminUserId: string
  supabaseId: string
  email: string
  fullName: string
  role: AdminRole
  permissions: string[]
}

export class AdminAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

function getBearerToken(request: NextRequest): string | null {
  return getAdminTokenFromRequest(request)
}

function assertIpAllowed(request: NextRequest): void {
  const ip = getClientIp(request)
  if (!checkIpAllowlist(ip)) {
    throw new AdminAuthError('Admin access denied from this IP address', 403, 'IP_NOT_ALLOWED')
  }
}

function parsePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((p): p is string => typeof p === 'string')
}

async function resolveAdminFromPayload(
  payload: Record<string, unknown>,
): Promise<AdminAuthContext | null> {
  const isSuperAdmin =
    payload.isSuperAdmin === true ||
    payload.is_super_admin === true ||
    (payload.app_metadata as Record<string, unknown> | undefined)?.is_super_admin === true

  const adminUserId = payload.adminUserId as string | undefined
  const supabaseId =
    (payload.supabaseId as string) ??
    (payload.user_id as string) ??
    (payload.sub as string)

  if (!supabaseId && !adminUserId) return null

  let admin = adminUserId
    ? await prisma.adminUser.findUnique({ where: { id: adminUserId } })
    : null

  if (!admin && supabaseId) {
    admin = await prisma.adminUser.findUnique({ where: { supabaseId } })
  }

  if (!admin && isSuperAdmin) {
    const email = (payload.email as string) ?? `${supabaseId}@admin.saios.app`
    admin = await prisma.adminUser.upsert({
      where: { supabaseId },
      create: {
        supabaseId,
        email,
        fullName: (payload.fullName as string) ?? (payload.name as string) ?? 'Platform Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
        lastLoginAt: new Date(),
      },
      update: { lastLoginAt: new Date() },
    })
  }

  if (!admin) {
    if (isSuperAdmin) {
      return {
        adminUserId: supabaseId,
        supabaseId,
        email: (payload.email as string) ?? 'admin@saios.app',
        fullName: (payload.fullName as string) ?? 'Platform Admin',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      }
    }
    return null
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    adminUserId: admin.id,
    supabaseId: admin.supabaseId,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: parsePermissions(admin.permissions),
  }
}

/**
 * Validates admin JWT (isSuperAdmin claim) and resolves AdminUser record.
 */
export async function authenticateAdminRequest(
  request: NextRequest,
): Promise<AdminAuthContext> {
  assertIpAllowed(request)

  const token = getBearerToken(request)
  if (!token) {
    throw new AdminAuthError('Missing authorization token', 401, 'UNAUTHORIZED')
  }

  try {
    const payload = await verifyAdminAccessToken(token)
    const admin = await resolveAdminFromPayload({
      adminUserId: payload.sub,
      supabaseId: payload.supabaseId,
      email: payload.email,
      fullName: payload.fullName,
      isSuperAdmin: true,
      role: payload.role,
    })
    if (!admin) {
      throw new AdminAuthError('Super admin access required', 403, 'FORBIDDEN')
    }
    return admin
  } catch (err) {
    if (err instanceof AdminAuthError) throw err
    throw new AdminAuthError('Invalid or expired admin token', 401, 'INVALID_TOKEN')
  }
}

/**
 * Validates admin JWT for admin UI routes (Edge-safe).
 */
export async function authenticateAdminFromSession(
  accessToken: string,
): Promise<AdminAuthContext | null> {
  try {
    const payload = await verifyAdminAccessToken(accessToken)
    return resolveAdminFromPayload({
      adminUserId: payload.sub,
      supabaseId: payload.supabaseId,
      email: payload.email,
      fullName: payload.fullName,
      isSuperAdmin: true,
      role: payload.role,
    })
  } catch {
    return null
  }
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  opts: {
    targetType?: string | null
    targetId?: string | null
    details?: Record<string, unknown>
    ipAddress?: string | null
  } = {},
): Promise<void> {
  if (adminUserId === 'dev-admin') return

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        details: (opts.details ?? {}) as Prisma.InputJsonValue,
        ipAddress: opts.ipAddress ?? null,
      },
    })
  } catch (err) {
    console.error('[adminAudit]', err)
  }
}

type AdminRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; auth: AdminAuthContext },
) => Promise<NextResponse>

function extractTargetFromPath(pathname: string): { targetType: string | null; targetId: string | null } {
  const segments = pathname.split('/').filter(Boolean)
  const adminIdx = segments.indexOf('admin')
  if (adminIdx === -1) return { targetType: null, targetId: null }

  const resource = segments[adminIdx + 1]
  const id = segments[adminIdx + 2]
  if (!resource) return { targetType: null, targetId: null }
  if (id && !['metrics', 'overview'].includes(id)) {
    return { targetType: resource, targetId: id }
  }
  return { targetType: resource, targetId: null }
}

/** Middleware factory for /api/admin/* routes — auth + automatic audit logging */
export function requireAdminAuth(handler: AdminRouteHandler) {
  return async (request: NextRequest, segmentContext: { params: Promise<Record<string, string>> }) => {
    try {
      const auth = await authenticateAdminRequest(request)
      const pathname = request.nextUrl.pathname
      const { targetType, targetId } = extractTargetFromPath(pathname)

      await logAdminAction(auth.adminUserId, `${request.method} ${pathname}`, {
        targetType,
        targetId,
        ipAddress: getClientIp(request),
        details: {
          query: Object.fromEntries(request.nextUrl.searchParams.entries()),
        },
      })

      return handler(request, { ...segmentContext, auth })
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return apiError(err.message, err.code, err.statusCode)
      }
      console.error('[adminAuth]', err)
      return apiError('Internal server error', 'INTERNAL_ERROR', 500)
    }
  }
}
