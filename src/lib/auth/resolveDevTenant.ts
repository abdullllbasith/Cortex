import { prisma } from '@/lib/db/prisma'
import { TenantAuthError } from '@/middleware/tenantAuth'

let cachedDevTenantId: string | null = null
const cachedDevUserByTenant = new Map<string, string>()

/** Map dev placeholder tenant IDs to a real seeded tenant in the database. */
export async function resolveDevTenantId(candidate?: string | null): Promise<string> {
  if (candidate && candidate !== 'dev-tenant-1') {
    const existing = await prisma.tenant.findUnique({ where: { id: candidate }, select: { id: true } })
    if (existing) {
      cachedDevTenantId = existing.id
      return existing.id
    }
  }

  if (cachedDevTenantId) return cachedDevTenantId

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'acme-corp' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!tenant) {
    throw new TenantAuthError('No seed tenant found. Run npm run db:seed', 500, 'NO_TENANT')
  }

  cachedDevTenantId = tenant.id
  return tenant.id
}

/** Resolve a real application user for dev-mode API calls (never a placeholder id). */
export async function resolveDevUserId(tenantId: string): Promise<string> {
  const cached = cachedDevUserByTenant.get(tenantId)
  if (cached) return cached

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const user =
    owner ??
    (await prisma.user.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (!user) {
    throw new TenantAuthError(
      'No user found for this workspace. Complete registration or run npm run db:seed.',
      404,
      'USER_NOT_FOUND',
    )
  }

  cachedDevUserByTenant.set(tenantId, user.id)
  return user.id
}

/** Map JWT/API identity to an active application user scoped to the tenant. */
export async function resolveTenantUserId(candidateId: string, tenantId: string): Promise<string> {
  if (candidateId === 'dev-user' && process.env.AUTH_DEV_MODE === 'true') {
    return resolveDevUserId(tenantId)
  }

  const byId = await prisma.user.findFirst({
    where: { id: candidateId, tenantId, isActive: true },
    select: { id: true },
  })
  if (byId) return byId.id

  const bySupabase = await prisma.user.findFirst({
    where: { supabaseId: candidateId, tenantId, isActive: true },
    select: { id: true },
  })
  if (bySupabase) return bySupabase.id

  if (process.env.AUTH_DEV_MODE === 'true') {
    return resolveDevUserId(tenantId)
  }

  throw new TenantAuthError(
    'User not found for this workspace',
    404,
    'USER_NOT_FOUND',
  )
}
