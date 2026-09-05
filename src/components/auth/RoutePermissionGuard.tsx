'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSessionStore, hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'
import { canAccessPath, firstAllowedPath } from '@/lib/auth/navPermissions'

/**
 * Blocks dashboard routes the signed-in user is not permitted to open.
 */
export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hasPermission = useSessionStore((s) => s.hasPermission)
  const accessToken = useSessionStore((s) => s.accessToken)
  const permissions = useSessionStore((s) => s.permissions)

  useEffect(() => {
    let cancelled = false

    const enforce = () => {
      if (cancelled) return
      // Wait until we have a real session — empty perms during hydrate cause bounce loops.
      if (!accessToken) return
      if (!canAccessPath(pathname, hasPermission)) {
        const fallback =
          pathname.startsWith('/settings')
            ? '/settings/profile'
            : firstAllowedPath(hasPermission)
        if (fallback !== pathname) router.replace(fallback)
      }
    }

    if (hasSessionHydrated()) {
      enforce()
      return () => {
        cancelled = true
      }
    }

    const unsub = onSessionHydrated(enforce)
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [pathname, accessToken, permissions, hasPermission, router])

  return children
}
