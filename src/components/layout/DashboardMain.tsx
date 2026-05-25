'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Routes that fill the viewport below TopBar — inner panes handle scroll. */
const FULL_HEIGHT_PATHS = ['/assistant']

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullHeight = FULL_HEIGHT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  return (
    <main
      id="main-content"
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-white dark:bg-slate-900',
        'pb-16 md:pb-0',
        fullHeight ? 'overflow-hidden' : 'overflow-y-auto',
      )}
    >
      {children}
    </main>
  )
}
