'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  GitBranch,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isNavItemActive } from './nav-config'

const items = [
  { label: 'Home',       href: '/dashboard', icon: LayoutDashboard },
  { label: 'Assistant',  href: '/assistant', icon: Bot },
  { label: 'Analytics',  href: '/analytics', icon: BarChart3 },
  { label: 'Workflows',  href: '/workflows', icon: GitBranch },
  { label: 'Settings',   href: '/settings',  icon: Settings },
] as const

/** Mobile-only sticky bottom navigation (hidden from md breakpoint up). */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-sticky md:hidden',
        'border-t border-slate-200 bg-white/95 backdrop-blur-md',
        'dark:border-slate-800 dark:bg-slate-950/95',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex h-16 items-stretch">
        {items.map(({ label, href, icon: Icon }) => {
          const active = isNavItemActive(href, pathname)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1',
                  'text-[10px] font-medium transition-colors',
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 h-1 w-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
