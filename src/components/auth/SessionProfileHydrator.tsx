'use client'

import { useEffect } from 'react'
import { apiClient } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import type { UserProfileDTO } from '@/lib/settings/types'
import type { TenantBranding } from '@/lib/branding/tenantBranding'

/** Restore avatar and workspace branding from the server after login or reload. */
export function SessionProfileHydrator() {
  const accessToken = useSessionStore((s) => s.accessToken)
  const tenantId = useSessionStore((s) => s.tenant?.id)
  const devSessionSynced = useSessionStore((s) => s.devSessionSynced)
  const updateUser = useSessionStore((s) => s.updateUser)
  const updateTenant = useSessionStore((s) => s.updateTenant)

  useEffect(() => {
    if (!accessToken || !tenantId || !devSessionSynced) return

    let cancelled = false

    void Promise.allSettled([
      apiClient.get<UserProfileDTO>('/settings/profile'),
      apiClient.get<TenantBranding & { name?: string | null }>('/settings/branding'),
    ]).then(([profileResult, brandingResult]) => {
      if (cancelled) return
      if (profileResult.status === 'fulfilled') {
        updateUser({
          name: profileResult.value.fullName,
          avatarUrl: profileResult.value.avatarUrl ?? undefined,
        })
      }
      if (brandingResult.status === 'fulfilled') {
        updateTenant({
          name: brandingResult.value.name ?? undefined,
          logoUrl: brandingResult.value.logoUrl ?? undefined,
          primaryColor: brandingResult.value.primaryColor ?? undefined,
          secondaryColor: brandingResult.value.secondaryColor ?? undefined,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, tenantId, devSessionSynced, updateUser, updateTenant])

  return null
}
