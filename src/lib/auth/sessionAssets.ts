import { prisma } from '@/lib/db/prisma'
import { isPersistedAssetUrl } from '@/lib/storage/localUpload'
import { parseTenantSettings } from '@/lib/settings/types'

export interface SessionBranding {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

export interface SessionPresentation {
  avatarUrl: string | null
  branding: SessionBranding
}

export async function loadSessionPresentation(
  userId: string,
  tenantId: string,
): Promise<SessionPresentation> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    select: { avatarUrl: true },
  })

  const rows = await prisma.$queryRaw<Array<{ settings: unknown }>>`
    SELECT "settings" FROM "tenants" WHERE "id" = ${tenantId} LIMIT 1
  `
  const settings = parseTenantSettings(rows[0]?.settings)
  const logoUrl =
    settings.logoUrl && isPersistedAssetUrl(settings.logoUrl) ? settings.logoUrl : null

  return {
    avatarUrl: isPersistedAssetUrl(user?.avatarUrl) ? user!.avatarUrl : null,
    branding: {
      logoUrl,
      primaryColor: settings.primaryColor ?? null,
      secondaryColor: settings.secondaryColor ?? null,
    },
  }
}
