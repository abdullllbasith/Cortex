import type { Tenant, User } from '@/lib/api/types'
import { apiClient } from '@/lib/api/apiClient'
import type { TenantBranding } from '@/lib/branding/tenantBranding'
import type { UserProfileDTO } from '@/lib/settings/types'
import { useSessionStore } from '@/store/sessionStore'

export interface AuthSessionUser extends Omit<User, 'avatarUrl'> {
  avatarUrl?: string | null
}

export interface AuthSessionTenant extends Tenant {
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}

export interface AuthSessionPayload {
  user: AuthSessionUser
  tenant: AuthSessionTenant
  permissions: string[]
  accessToken: string
  refreshToken?: string
}

/** Pull avatar + workspace branding from the API (e.g. right after login). */
export async function hydrateSessionFromServer(): Promise<void> {
  const { accessToken, tenant } = useSessionStore.getState()
  if (!accessToken || !tenant?.id) return

  const [profileResult, brandingResult] = await Promise.allSettled([
    apiClient.get<UserProfileDTO>('/settings/profile'),
    apiClient.get<TenantBranding & { name?: string | null }>('/settings/branding'),
  ])

  if (profileResult.status === 'fulfilled') {
    const profile = profileResult.value
    useSessionStore.getState().updateUser({
      name: profile.fullName,
      avatarUrl: profile.avatarUrl ?? undefined,
    })
  }

  if (brandingResult.status === 'fulfilled') {
    const branding = brandingResult.value
    useSessionStore.getState().updateTenant({
      name: branding.name ?? undefined,
      logoUrl: branding.logoUrl ?? undefined,
      primaryColor: branding.primaryColor ?? undefined,
      secondaryColor: branding.secondaryColor ?? undefined,
    })
  }
}

export function applyAuthSession(payload: AuthSessionPayload): void {
  const { user, tenant, permissions, accessToken, refreshToken } = payload
  useSessionStore.getState().setSession({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl ?? undefined,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      logoUrl: tenant.logoUrl ?? undefined,
      primaryColor: tenant.primaryColor ?? undefined,
      secondaryColor: tenant.secondaryColor ?? undefined,
    },
    permissions,
    accessToken,
    refreshToken,
  })
}

export function mapIssueSessionToClientPayload(
  session: {
    user: { id: string; email: string; fullName: string; role: string }
    tenant: { id: string; name: string; slug: string; plan: string }
    permissions: string[]
    accessToken: string
    refreshToken?: string
  },
  presentation: { avatarUrl: string | null; branding: SessionBrandingFromAssets },
): AuthSessionPayload {
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.fullName,
      role: session.user.role.toLowerCase(),
      avatarUrl: presentation.avatarUrl,
    },
    tenant: {
      id: session.tenant.id,
      name: session.tenant.name,
      slug: session.tenant.slug,
      plan: session.tenant.plan,
      logoUrl: presentation.branding.logoUrl,
      primaryColor: presentation.branding.primaryColor,
      secondaryColor: presentation.branding.secondaryColor,
    },
    permissions: session.permissions as string[],
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  }
}

type SessionBrandingFromAssets = {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}
