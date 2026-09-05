import type { TenantPlan } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { TenantAuthError } from '@/middleware/tenantAuth'
import { loadSessionPresentation } from '@/lib/auth/sessionAssets'
import { resolveCanonicalUserByEmail } from '@/lib/auth/resolveCanonicalUser'

let cachedDevTenantId: string | null = null
const cachedDevUserByTenant = new Map<string, string>()

export type DevBootstrapContext = {
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
    logoUrl: string | null
    primaryColor: string | null
    secondaryColor: string | null
  }
  user: {
    id: string
    email: string
    name: string
    role: string
    avatarUrl: string | null
  }
}

async function mapDevBootstrap(
  user: { id: string; email: string; fullName: string; role: string },
  tenant: { id: string; name: string; slug: string; plan: TenantPlan },
): Promise<DevBootstrapContext> {
  const presentation = await loadSessionPresentation(user.id, tenant.id)
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan.toLowerCase(),
      logoUrl: presentation.branding.logoUrl,
      primaryColor: presentation.branding.primaryColor,
      secondaryColor: presentation.branding.secondaryColor,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role.toLowerCase(),
      avatarUrl: presentation.avatarUrl,
    },
  }
}

/**
 * Resolves which workspace/user dev mode should impersonate.
 * Prefers DEV_USER_EMAIL, then an explicit tenant id, then the acme-corp seed owner.
 */
export async function resolveDevBootstrapContext(options?: {
  tenantId?: string | null
  email?: string | null
}): Promise<DevBootstrapContext | null> {
  const devEmail = (options?.email ?? process.env.DEV_USER_EMAIL)?.trim().toLowerCase()
  if (devEmail) {
    const byEmail = await resolveCanonicalUserByEmail(devEmail)
    if (byEmail?.tenant) {
      cachedDevTenantId = byEmail.tenant.id
      cachedDevUserByTenant.set(byEmail.tenant.id, byEmail.id)
      return mapDevBootstrap(byEmail, byEmail.tenant)
    }
  }

  const tenantId = options?.tenantId
  if (tenantId && tenantId !== 'dev-tenant-1') {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, plan: true },
    })
    if (tenant) {
      const owner = await prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, fullName: true, role: true },
      })
      const user =
        owner ??
        (await prisma.user.findFirst({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, fullName: true, role: true },
        }))
      if (user) {
        cachedDevTenantId = tenant.id
        cachedDevUserByTenant.set(tenant.id, user.id)
        return mapDevBootstrap(user, tenant)
      }
    }
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'acme-corp' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, slug: true, plan: true },
  })
  if (!tenant) return null

  const owner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, fullName: true, role: true },
  })
  if (!owner) return null

  cachedDevTenantId = tenant.id
  cachedDevUserByTenant.set(tenant.id, owner.id)
  return mapDevBootstrap(owner, tenant)
}

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

  const bootstrap = await resolveDevBootstrapContext()
  if (!bootstrap) {
    throw new TenantAuthError('No seed tenant found. Run npm run db:seed', 500, 'NO_TENANT')
  }

  cachedDevTenantId = bootstrap.tenant.id
  return bootstrap.tenant.id
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
    where: { id: candidateId, tenantId },
    select: { id: true, isActive: true },
  })
  if (byId) {
    if (!byId.isActive) {
      throw new TenantAuthError('This account has been suspended', 403, 'ACCOUNT_SUSPENDED')
    }
    return byId.id
  }

  const bySupabase = await prisma.user.findFirst({
    where: { supabaseId: candidateId, tenantId },
    select: { id: true, isActive: true },
  })
  if (bySupabase) {
    if (!bySupabase.isActive) {
      throw new TenantAuthError('This account has been suspended', 403, 'ACCOUNT_SUSPENDED')
    }
    return bySupabase.id
  }

  throw new TenantAuthError(
    'User not found for this workspace',
    404,
    'USER_NOT_FOUND',
  )
}
