import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache/redis'
import {
  type Permission,
  PERMISSIONS,
} from '@/lib/auth/permissions'
import { resolveRolePermissions } from '@/lib/settings/permissionCategories'
import { parseTenantSettings } from '@/lib/settings/types'
import type { UserRole } from '@prisma/client'
import {
  authenticateTenantRequest,
  TenantAuthError,
  type TenantAuthContext,
} from '@/middleware/tenantAuth'
import { apiError } from '@/lib/knowledge/response'
import { logSecurityEvent } from '@/lib/audit/securityMonitor'

const PERM_CACHE_TTL = 120 // 2 minutes

function permCacheKey(userId: string, tenantId: string): string {
  return `saios:perms:${tenantId}:${userId}`
}

export async function getEffectivePermissions(
  userId: string,
  tenantId: string,
): Promise<Permission[]> {
  if (process.env.AUTH_DEV_MODE === 'true' && userId === 'dev-user') {
    return Object.values(PERMISSIONS)
  }

  const cached = await cacheGet<Permission[]>(permCacheKey(userId, tenantId))
  if (cached) return cached

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    include: { customRole: true },
  })

  if (!user) return []

  const tenantRows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  const settings = parseTenantSettings(tenantRows[0]?.settings) as {
    rolePermissionOverrides?: Partial<Record<UserRole, Permission[]>>
  }
  const overrides = settings.rolePermissionOverrides

  let perms = resolveRolePermissions(user.role, overrides)

  if (user.customRole?.permissions) {
    const custom = user.customRole.permissions as Permission[]
    perms = [...new Set([...perms, ...custom])]
  }

  const extra = user.customPermissions as Permission[] | null
  if (Array.isArray(extra) && extra.length > 0) {
    perms = [...new Set([...perms, ...extra])]
  }

  await cacheSet(permCacheKey(userId, tenantId), perms, PERM_CACHE_TTL)
  return perms
}

export async function hasPermission(
  userId: string,
  tenantId: string,
  permission: Permission,
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, tenantId)
  return perms.includes(permission)
}

export async function invalidatePermissionCache(userId: string, tenantId: string): Promise<void> {
  await cacheDel(permCacheKey(userId, tenantId))
}

export async function assertPermission(
  auth: TenantAuthContext,
  permission: Permission,
  request?: NextRequest,
): Promise<void> {
  if (process.env.AUTH_DEV_MODE === 'true' && auth.userId === 'dev-user') return
  if ((auth.permissions as string[]).includes('*')) return

  const allowed =
    auth.permissions.includes(permission) ||
    (await hasPermission(auth.userId, auth.tenantId, permission))

  if (!allowed) {
    if (request) {
      void logSecurityEvent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        eventType: 'PERMISSION_DENIED',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
        metadata: { permission },
      })
    }
    throw new TenantAuthError('Insufficient permissions', 403, 'FORBIDDEN')
  }
}

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; auth: TenantAuthContext },
) => Promise<NextResponse>

/** Middleware factory for API routes requiring a specific permission */
export function requirePermission(permission: Permission) {
  return function wrap(handler: RouteHandler) {
    return async (request: NextRequest, segmentContext: { params: Promise<Record<string, string>> }) => {
      try {
        const auth = await authenticateTenantRequest(request)
        await assertPermission(auth, permission, request)
        return handler(request, { ...segmentContext, auth })
      } catch (err) {
        if (err instanceof TenantAuthError) {
          return apiError(err.message, err.code, err.statusCode)
        }
        console.error('[rbac]', err)
        return apiError('Internal server error', 'INTERNAL_ERROR', 500)
      }
    }
  }
}

/** Map HTTP method + path prefix to required permission */
export const ROUTE_PERMISSIONS: Array<{
  match: RegExp
  method?: string
  permission: Permission
}> = [
  { match: /^\/api\/knowledge/, permission: PERMISSIONS.KNOWLEDGE_READ },
  { match: /^\/api\/knowledge/, method: 'POST', permission: PERMISSIONS.KNOWLEDGE_WRITE },
  { match: /^\/api\/knowledge/, method: 'PUT', permission: PERMISSIONS.KNOWLEDGE_WRITE },
  { match: /^\/api\/knowledge/, method: 'DELETE', permission: PERMISSIONS.KNOWLEDGE_DELETE },
  { match: /^\/api\/analytics/, permission: PERMISSIONS.ANALYTICS_VIEW },
  { match: /^\/api\/predictions/, permission: PERMISSIONS.PREDICTIONS_VIEW },
  { match: /^\/api\/workflows/, method: 'GET', permission: PERMISSIONS.WORKFLOWS_VIEW },
  { match: /^\/api\/workflows/, method: 'POST', permission: PERMISSIONS.WORKFLOWS_CREATE },
  { match: /^\/api\/workflows/, method: 'PUT', permission: PERMISSIONS.WORKFLOWS_CREATE },
  { match: /^\/api\/workflows/, method: 'DELETE', permission: PERMISSIONS.WORKFLOWS_DELETE },
  { match: /^\/api\/workflows\/.*\/execute/, method: 'POST', permission: PERMISSIONS.WORKFLOWS_EXECUTE },
  { match: /^\/api\/agents/, permission: PERMISSIONS.AGENTS_USE },
  { match: /^\/api\/assistant/, permission: PERMISSIONS.AGENTS_USE },
  { match: /^\/api\/alerts/, permission: PERMISSIONS.PREDICTIONS_VIEW },
  { match: /^\/api\/notifications/, permission: PERMISSIONS.PREDICTIONS_VIEW },
  { match: /^\/api\/settings\/general/, permission: PERMISSIONS.SETTINGS_MANAGE },
  { match: /^\/api\/settings\/webhooks/, permission: PERMISSIONS.SETTINGS_MANAGE },
  { match: /^\/api\/settings\/billing/, permission: PERMISSIONS.BILLING_MANAGE },
  { match: /^\/api\/settings\/profile/, permission: PERMISSIONS.KNOWLEDGE_READ },
  { match: /^\/api\/settings\/sessions/, permission: PERMISSIONS.KNOWLEDGE_READ },
  { match: /^\/api\/settings\/api-keys/, permission: PERMISSIONS.API_KEYS_MANAGE },
  { match: /^\/api\/settings\/team/, permission: PERMISSIONS.TEAM_MANAGE },
  { match: /^\/api\/settings\/roles/, permission: PERMISSIONS.TEAM_MANAGE },
  { match: /^\/api\/tenants\/invitations/, permission: PERMISSIONS.TEAM_MANAGE },
  { match: /^\/api\/audit/, permission: PERMISSIONS.AUDIT_VIEW },
  { match: /^\/api\/inventory/, method: 'GET', permission: PERMISSIONS.INVENTORY_VIEW },
  { match: /^\/api\/inventory/, method: 'POST', permission: PERMISSIONS.INVENTORY_MANAGE },
  { match: /^\/api\/inventory/, method: 'PUT', permission: PERMISSIONS.INVENTORY_MANAGE },
  { match: /^\/api\/inventory/, method: 'DELETE', permission: PERMISSIONS.INVENTORY_MANAGE },
]

// Fix typo - PER_PERMISSIONS doesn't exist
export function resolveRoutePermission(pathname: string, method: string): Permission | null {
  const upper = method.toUpperCase()
  // Method-specific rules first
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.method && rule.method !== upper) continue
    if (rule.match.test(pathname)) return rule.permission
  }
  // Path-only rules
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.method) continue
    if (rule.match.test(pathname)) return rule.permission
  }
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/channels')) {
    if (upper === 'GET' || upper === 'HEAD') return PERMISSIONS.KNOWLEDGE_READ
    return PERMISSIONS.KNOWLEDGE_WRITE
  }
  return null
}
