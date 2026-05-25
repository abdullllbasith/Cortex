import { NextRequest } from 'next/server'

import { jwtVerify, decodeJwt } from 'jose'

import { resolveDevTenantId, resolveDevUserId, resolveTenantUserId } from '@/lib/auth/resolveDevTenant'

import { getEffectivePermissions } from '@/lib/auth/rbac'

import { validateApiKey } from '@/lib/security/apiKeyManager'

import type { Permission } from '@/lib/auth/permissions'

import {

  getImpersonationTokenFromRequest,

  logImpersonationAction,

  verifyImpersonationToken,

} from '@/lib/admin/impersonationService'



export interface TenantAuthContext {

  tenantId: string

  userId: string

  permissions: Permission[]

  isImpersonation?: boolean

  impersonationAdminId?: string

  impersonationTenantName?: string

}



export class TenantAuthError extends Error {

  constructor(

    message: string,

    readonly statusCode: number,

    readonly code: string,

  ) {

    super(message)

    this.name = 'TenantAuthError'

  }

}



function getBearerToken(request: NextRequest): string | null {

  const auth = request.headers.get('authorization')

  if (!auth?.startsWith('Bearer ')) return null

  return auth.slice(7)

}



function isDevPlaceholderToken(token: string | null): boolean {

  return !token || token === 'dev-token'

}



async function authenticateDevRequest(headerTenantId: string | null): Promise<TenantAuthContext> {

  const tenantId = await resolveDevTenantId(headerTenantId)

  const userId = await resolveDevUserId(tenantId)

  return {

    tenantId,

    userId,

    permissions: ['*'] as unknown as Permission[],

  }

}



/**

 * Validates JWT and extracts tenantId.

 * In dev mode (AUTH_DEV_MODE=true), accepts x-tenant-id with placeholder dev-token only.

 */

export async function authenticateTenantRequest(

  request: NextRequest,

): Promise<TenantAuthContext> {

  const token = getBearerToken(request)

  const headerTenantId = request.headers.get('x-tenant-id')



  const impersonationToken = getImpersonationTokenFromRequest(request)

  if (impersonationToken && !impersonationToken.startsWith('sk_saios_')) {

    const imp = await verifyImpersonationToken(impersonationToken)

    if (imp) {

      await logImpersonationAction(

        imp,

        `${request.method} ${request.nextUrl.pathname}`,

        request,

      )

      return {

        tenantId: imp.tenantId,

        userId: imp.sub,

        permissions: ['*'] as unknown as Permission[],

        isImpersonation: true,

        impersonationAdminId: imp.adminId,

        impersonationTenantName: imp.tenantName,

      }

    }

  }



  if (!token) {

    if (process.env.AUTH_DEV_MODE === 'true') {

      return authenticateDevRequest(headerTenantId)

    }

    throw new TenantAuthError('Missing authorization token', 401, 'UNAUTHORIZED')

  }



  // API key auth

  if (token.startsWith('sk_saios_')) {

    const key = await validateApiKey(token)

    if (!key) {

      throw new TenantAuthError('Invalid API key', 401, 'INVALID_API_KEY')

    }

    if (headerTenantId && headerTenantId !== key.tenantId) {

      throw new TenantAuthError('Tenant ID mismatch', 403, 'TENANT_MISMATCH')

    }

    return {

      tenantId: key.tenantId,

      userId: key.userId,

      permissions: key.permissions,

    }

  }



  // Dev placeholder token — map to a real tenant + user row in Postgres

  if (process.env.AUTH_DEV_MODE === 'true' && isDevPlaceholderToken(token)) {

    return authenticateDevRequest(headerTenantId)

  }



  const secret = process.env.JWT_SECRET

  if (!secret) {

    throw new TenantAuthError('JWT_SECRET not configured', 500, 'CONFIG_ERROR')

  }



  let payload: Record<string, unknown>



  try {

    const verified = await jwtVerify(token, new TextEncoder().encode(secret))

    payload = verified.payload as Record<string, unknown>

  } catch {

    if (process.env.AUTH_DEV_MODE === 'true') {

      payload = decodeJwt(token) as Record<string, unknown>

    } else {

      throw new TenantAuthError('Invalid or expired token', 401, 'INVALID_TOKEN')

    }

  }



  let tenantId = (payload.tenantId as string) ?? headerTenantId

  const rawUserId = (payload.sub as string) ?? (payload.userId as string)



  if (!tenantId) {

    throw new TenantAuthError('Tenant ID missing from token', 403, 'MISSING_TENANT')

  }



  if (headerTenantId && headerTenantId !== tenantId) {

    if (process.env.AUTH_DEV_MODE === 'true') {

      tenantId = headerTenantId

    } else {

      throw new TenantAuthError('Tenant ID mismatch', 403, 'TENANT_MISMATCH')

    }

  }



  if (!rawUserId) {

    throw new TenantAuthError('User ID missing from token', 401, 'INVALID_TOKEN')

  }



  if (payload.mfaPending) {

    throw new TenantAuthError('MFA verification required', 403, 'MFA_REQUIRED')

  }



  const userId = await resolveTenantUserId(rawUserId, tenantId)



  let permissions = (payload.permissions as Permission[]) ?? []

  if (permissions.length === 0) {

    permissions = await getEffectivePermissions(userId, tenantId)

  }



  return {

    tenantId,

    userId,

    permissions,

  }

}


