'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useSessionStore, hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'

/**
 * Recovers access token from the httpOnly refresh cookie when local session is stale.
 * Clears cookies and sends the user to login when recovery fails (avoids redirect loops).
 */
export function DashboardSessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const accessToken = useSessionStore((s) => s.accessToken)
  const user = useSessionStore((s) => s.user)
  const setSession = useSessionStore((s) => s.setSession)
  const clearSession = useSessionStore((s) => s.clearSession)
  const [recovering, setRecovering] = useState(!accessToken)

  useEffect(() => {
    let cancelled = false

    async function recover() {
      const state = useSessionStore.getState()
      if (state.accessToken) {
        if (!cancelled) setRecovering(false)
        return
      }

      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        if (cancelled) return

        if (!res.ok) {
          clearSession()
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
            () => undefined,
          )
          window.location.href = `/login?expired=1&redirect=${encodeURIComponent(pathname)}`
          return
        }

        const json = await res.json()
        const data = json.data
        if (!data?.accessToken || !data?.user || !data?.tenant) {
          clearSession()
          window.location.href = `/login?expired=1&redirect=${encodeURIComponent(pathname)}`
          return
        }

        setSession({
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            avatarUrl: data.user.avatarUrl ?? undefined,
          },
          tenant: {
            id: data.tenant.id,
            name: data.tenant.name,
            slug: data.tenant.slug,
            plan: data.tenant.plan,
            logoUrl: data.tenant.logoUrl ?? undefined,
            primaryColor: data.tenant.primaryColor ?? undefined,
            secondaryColor: data.tenant.secondaryColor ?? undefined,
          },
          permissions: data.permissions ?? [],
          accessToken: data.accessToken,
        })
      } catch {
        if (!cancelled) {
          clearSession()
          window.location.href = `/login?expired=1&redirect=${encodeURIComponent(pathname)}`
        }
      } finally {
        if (!cancelled) setRecovering(false)
      }
    }

    const run = () => {
      if (useSessionStore.getState().accessToken) {
        setRecovering(false)
        return
      }
      void recover()
    }

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
  }, [accessToken, user, pathname, setSession, clearSession])

  if (recovering && !accessToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">Restoring your session…</p>
      </div>
    )
  }

  return children
}
