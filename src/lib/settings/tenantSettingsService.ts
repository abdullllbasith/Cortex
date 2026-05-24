import { prisma } from '@/lib/db/prisma'
import type { TenantSettings } from './types'
import { parseTenantSettings } from './types'
import { isPersistedAssetUrl, normalizePersistedUrl } from '@/lib/storage/localUpload'

async function readTenantSettings(tenantId: string): Promise<TenantSettings> {
  const rows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  return parseTenantSettings(rows[0]?.settings)
}

async function writeTenantGeneral(
  tenantId: string,
  name: string | undefined,
  settings: TenantSettings,
) {
  const payload = JSON.stringify(settings)

  if (name) {
    await prisma.$executeRaw`
      UPDATE "tenants"
      SET "name" = ${name},
          "settings" = ${payload}::jsonb,
          "updatedAt" = NOW()
      WHERE "id" = ${tenantId}
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "tenants"
      SET "settings" = ${payload}::jsonb,
          "updatedAt" = NOW()
      WHERE "id" = ${tenantId}
    `
  }
}

async function readTenantRow(tenantId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string; slug: string; plan: string }>
  >`
    SELECT "id", "name", "slug", "plan"::text AS "plan"
    FROM "tenants"
    WHERE "id" = ${tenantId}
    LIMIT 1
  `
  const tenant = rows[0]
  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export async function getTenantGeneral(tenantId: string, appUrl: string) {
  const tenant = await readTenantRow(tenantId)
  const settings = await readTenantSettings(tenantId)
  if (settings.logoUrl && !isPersistedAssetUrl(settings.logoUrl)) {
    settings.logoUrl = null
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan.toLowerCase(),
    workspaceUrl: `${appUrl.replace(/\/$/, '')}/${tenant.slug}`,
    settings,
  }
}

export async function updateTenantGeneral(
  tenantId: string,
  data: { name?: string; settings?: TenantSettings },
  appUrl: string,
) {
  const existing = await readTenantSettings(tenantId)
  const incoming = data.settings ? { ...data.settings } : undefined
  if (incoming?.logoUrl !== undefined) {
    incoming.logoUrl = normalizePersistedUrl(incoming.logoUrl) ?? null
  }
  const merged = incoming ? { ...existing, ...incoming } : existing

  await writeTenantGeneral(tenantId, data.name, merged)

  const tenant = await readTenantRow(tenantId)

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan.toLowerCase(),
    workspaceUrl: `${appUrl.replace(/\/$/, '')}/${tenant.slug}`,
    settings: await readTenantSettings(tenantId),
  }
}
