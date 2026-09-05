'use client'

import { useEffect } from 'react'
import { apiClient } from '@/lib/api/apiClient'
import { useSessionStore, hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'

/**
 * Keeps client permission list in sync with the server (role matrix changes, re-login).
 */
export function PermissionsSync() {
  const accessToken = useSessionStore((s) => s.accessToken)
  const setSession = useSessionStore((s) => s.setSession)

  useEffect(() => {
    if (!accessToken || accessToken === 'dev-token') return

    let cancelled = false

    const sync = async () => {
      try {
        const data = await apiClient.get<{ permissions: string[] }>('/auth/permissions')
        if (cancelled || !data?.permissions) return

        const state = useSessionStore.getState()
        if (!state.user || !state.tenant || !state.accessToken) return

        const next = data.permissions
        const prev = state.permissions
        if (
          next.length === prev.length &&
          next.every((p, i) => p === prev[i])
        ) {
          return
        }

        setSession({
          user: state.user,
          tenant: state.tenant,
          permissions: next,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken ?? undefined,
        })
      } catch {
        /* optional sync */
      }
    }

    const run = () => {
      void sync()
    }

    if (hasSessionHydrated()) {
      run()
    } else {
      const unsub = onSessionHydrated(run)
      return () => {
        cancelled = true
        unsub?.()
      }
    }

    return () => {
      cancelled = true
    }
  }, [accessToken, setSession])

  return null
}
