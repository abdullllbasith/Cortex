'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSessionStore, hasSessionHydrated, onSessionHydrated } from '@/store/sessionStore'
import { createSupabaseBrowserClient } from '@/lib/auth/supabaseClient'

/**
 * Verifies session in the background without blocking dashboard paint.
 */
export function DashboardSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const accessToken = useSessionStore((s) => s.accessToken)
  const user = useSessionStore((s) => s.user)

  useEffect(() => {
    let cancelled = false

    async function verify() {
      if (accessToken || user) return

      const supabase = createSupabaseBrowserClient()
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        if (!cancelled && !data.session && !accessToken) {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
        }
      } else if (!cancelled && !accessToken && !user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
      }
    }

    const run = () => {
      if (hasSessionHydrated()) {
        void verify()
        return
      }
      return onSessionHydrated(() => {
        void verify()
      })
    }

    const unsub = run()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [accessToken, user, router, pathname])

  return children
}
