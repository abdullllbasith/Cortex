'use client'

import { useEffect } from 'react'
import { apiClient } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import type { UserProfileDTO } from '@/lib/settings/types'

/** Restore avatar/name from the server after reload so shell UI stays in sync. */
export function SessionProfileHydrator() {
  const accessToken = useSessionStore((s) => s.accessToken)
  const tenantId = useSessionStore((s) => s.tenant?.id)
  const updateUser = useSessionStore((s) => s.updateUser)

  useEffect(() => {
    if (!accessToken || !tenantId) return

    apiClient
      .get<UserProfileDTO>('/settings/profile')
      .then((profile) => {
        updateUser({
          name: profile.fullName,
          avatarUrl: profile.avatarUrl ?? undefined,
        })
      })
      .catch(() => {
        /* profile fetch optional during bootstrap */
      })
  }, [accessToken, tenantId, updateUser])

  return null
}
