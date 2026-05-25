'use client'

import { useEffect } from 'react'
import { useSessionStore, hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'
import { apiClient } from '@/lib/api/apiClient'

function isDevPlaceholderSession(accessToken: string | null, tenantId: string | undefined): boolean {
  return (
    !accessToken ||
    accessToken === 'dev-token' ||
    tenantId === 'dev-tenant-1' ||
    !tenantId
  )
}

function patchSessionAssets(tenantData: {
  user: { id: string; email: string; name: string; role: string; avatarUrl?: string | null }
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}) {
  const { accessToken, tenant: t, user, permissions, refreshToken } = useSessionStore.getState()
  if (!accessToken || !t || !user) return

  const needsAvatar = !user.avatarUrl && tenantData.user.avatarUrl
  const needsLogo = !t.logoUrl && tenantData.logoUrl
  const needsColors =
    (!t.primaryColor && tenantData.primaryColor) ||
    (!t.secondaryColor && tenantData.secondaryColor)

  if (!needsAvatar && !needsLogo && !needsColors) return

  useSessionStore.getState().setSession({
    user: {
      ...user,
      avatarUrl: user.avatarUrl ?? tenantData.user.avatarUrl ?? undefined,
    },
    tenant: {
      ...t,
      logoUrl: t.logoUrl ?? tenantData.logoUrl ?? undefined,
      primaryColor: t.primaryColor ?? tenantData.primaryColor ?? undefined,
      secondaryColor: t.secondaryColor ?? tenantData.secondaryColor ?? undefined,
    },
    permissions,
    accessToken,
    refreshToken: refreshToken ?? undefined,
  })
}

/**
 * Ensures API calls use the workspace tied to DEV_USER_EMAIL after re-seed / server restart.
 * Never replaces a real Supabase/JWT login — only fills dev placeholders or missing assets.
 */
export function DevSessionBootstrap() {
  const accessToken = useSessionStore((s) => s.accessToken)
  const tenantId = useSessionStore((s) => s.tenant?.id)
  const setSession = useSessionStore((s) => s.setSession)
  const setDevSessionSynced = useSessionStore((s) => s.setDevSessionSynced)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (process.env.NEXT_PUBLIC_AUTH_DEV_MODE === 'false') return

    const devEmail = process.env.NEXT_PUBLIC_DEV_USER_EMAIL?.trim()
    if (!devEmail) return

    const placeholder = isDevPlaceholderSession(accessToken, tenantId)
    if (placeholder) setDevSessionSynced(false)

    let cancelled = false

    const sync = () => {
      const params = new URLSearchParams({ email: devEmail })
      const currentTenantId = useSessionStore.getState().tenant?.id
      if (currentTenantId && currentTenantId !== 'dev-tenant-1') {
        params.set('tenantId', currentTenantId)
      }

      apiClient
        .get<{
          id: string
          name: string
          slug: string
          plan: string
          logoUrl?: string | null
          primaryColor?: string | null
          secondaryColor?: string | null
          user?: {
            id: string
            email: string
            name: string
            role: string
            avatarUrl?: string | null
          } | null
        }>(`/dev/tenant?${params}`, { public: true })
        .then((tenantData) => {
          if (cancelled || !tenantData?.id || !tenantData.user) return

          const {
            accessToken: liveToken,
            tenant: liveTenant,
            user: liveUser,
            permissions,
            refreshToken,
          } = useSessionStore.getState()

          const hasRealJwt = Boolean(liveToken && liveToken !== 'dev-token')

          // Real login always wins — only backfill missing avatar/logo.
          if (hasRealJwt) {
            patchSessionAssets({ ...tenantData, user: tenantData.user })
            return
          }

          const livePlaceholder = isDevPlaceholderSession(liveToken, liveTenant?.id)
          const tenantMismatch = liveTenant?.id !== tenantData.id
          const userMismatch =
            liveUser?.email?.toLowerCase() !== tenantData.user.email.toLowerCase()

          if (!livePlaceholder && !tenantMismatch && !userMismatch) {
            patchSessionAssets({ ...tenantData, user: tenantData.user })
            return
          }

          setSession({
            user: {
              id: tenantData.user.id,
              email: tenantData.user.email,
              name: tenantData.user.name,
              role: tenantData.user.role,
              avatarUrl: tenantData.user.avatarUrl ?? undefined,
            },
            tenant: {
              id: tenantData.id,
              name: tenantData.name,
              slug: tenantData.slug,
              plan: tenantData.plan,
              logoUrl: tenantData.logoUrl ?? undefined,
              primaryColor: tenantData.primaryColor ?? undefined,
              secondaryColor: tenantData.secondaryColor ?? undefined,
            },
            permissions: permissions.length ? permissions : ['*'],
            accessToken: 'dev-token',
            refreshToken: refreshToken ?? undefined,
          })
        })
        .catch(() => {
          /* dev bootstrap optional */
        })
        .finally(() => {
          if (!cancelled) setDevSessionSynced(true)
        })
    }

    const run = () => sync()

    if (hasSessionHydrated()) {
      run()
      return () => {
        cancelled = true
      }
    }

    const unsub = onSessionHydrated(run)
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [accessToken, tenantId, setSession, setDevSessionSynced])

  return null
}
