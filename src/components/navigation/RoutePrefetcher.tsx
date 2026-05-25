'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { navSections } from '@/components/layout/nav-config'

const NAV_HREFS = navSections.flatMap((section) =>
  section.items.filter((item) => !item.placeholder).map((item) => item.href),
)

/** Warm route bundles during idle time so sidebar clicks feel instant in dev. */
export function RoutePrefetcher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const prefetch = (href: string) => {
      if (cancelled) return
      try {
        router.prefetch(href)
      } catch {
        /* prefetch optional */
      }
    }

    const prefetchAll = () => {
      for (const href of NAV_HREFS) prefetch(href)
    }

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 4000 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }

    const timer = window.setTimeout(prefetchAll, 1500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [router])

  return null
}
