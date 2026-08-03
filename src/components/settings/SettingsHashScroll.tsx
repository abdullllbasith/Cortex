'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Scroll to in-page anchor after settings nav hash links. */
export function SettingsHashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    const id = hash.slice(1)
    const scroll = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const timer = window.setTimeout(scroll, 50)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1)
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return null
}
