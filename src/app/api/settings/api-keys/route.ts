import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS, ALL_PERMISSIONS, type Permission } from '@/lib/auth/permissions'
import { generateApiKey, listApiKeys, revokeApiKey } from '@/lib/security/apiKeyManager'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
})

export const GET = requirePermission(PERMISSIONS.API_KEYS_MANAGE)(async (_request, { auth }) => {
  try {
    const keys = await listApiKeys(auth.tenantId)
    return NextResponse.json(apiSuccess(keys))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = requirePermission(PERMISSIONS.API_KEYS_MANAGE)(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const perms = body.permissions.filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission),
    )
    if (perms.length === 0) {
      return NextResponse.json({ success: false, error: { message: 'Invalid permissions' } }, { status: 400 })
    }
    const key = await generateApiKey(
      auth.tenantId,
      auth.userId,
      body.name,
      perms,
      body.expiresAt ? new Date(body.expiresAt) : null,
    )
    return NextResponse.json(apiSuccess(key), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = requirePermission(PERMISSIONS.API_KEYS_MANAGE)(async (request, { auth }) => {
  try {
    const keyId = request.nextUrl.searchParams.get('id')
    if (!keyId) {
      return NextResponse.json({ success: false, error: { message: 'Key id required' } }, { status: 400 })
    }
    await revokeApiKey(keyId, auth.tenantId)
    return NextResponse.json(apiSuccess({ revoked: true }))
  } catch (err) {
    return handleRouteError(err)
  }
})
