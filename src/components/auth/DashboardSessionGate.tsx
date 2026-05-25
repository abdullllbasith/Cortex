'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Skeleton, SkeletonCard } from '@/components/ui'
import { useSessionStore } from '@/store/sessionStore'
import { createSupabaseBrowserClient } from '@/lib/auth/supabaseClient'

function DashboardShellSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 space-y-1">
        <Skeleton height="20px" width="w-32" className="rounded" />
        <Skeleton height="14px" width="w-64" className="rounded" />
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton height="280px" className="rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Blocks dashboard chrome until Zustand session is hydrated and Supabase session
 * (or dev mode) is verified — prevents flash of unauthenticated content.
 */
export function DashboardSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const accessToken = useSessionStore((s) => s.accessToken)
  const user = useSessionStore((s) => s.user)

  useEffect(() => {
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useSessionStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return

    let cancelled = false

    async function verify() {
      const supabase = createSupabaseBrowserClient()
      if (supabase) {
        const { data } = await supabase.auth.getSession()
        if (!data.session && !accessToken) {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
          return
        }
      } else if (!accessToken && !user) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
        return
      }

      if (!cancelled) setReady(true)
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [hydrated, accessToken, user, router, pathname])

  if (!hydrated || !ready) {
    return <DashboardShellSkeleton />
  }

  return children
}
