'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Database,
  Download,
  Globe,
  Key,
  Palette,
  Plug,
  Receipt,
  Shield,
  Trash2,
  User,
  Users,
  Webhook,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsNavItem {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  danger?: boolean
}

export interface SettingsNavSection {
  title: string
  items: SettingsNavItem[]
}

export const SETTINGS_NAV: SettingsNavSection[] = [
  {
    title: 'ACCOUNT',
    items: [
      { label: 'General', href: '/settings/general', icon: Globe },
      { label: 'Profile', href: '/settings/profile', icon: User },
      { label: 'Security', href: '/settings/security', icon: Shield },
    ],
  },
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Team', href: '/settings/team', icon: Users },
      { label: 'Roles & Permissions', href: '/settings/roles', icon: Shield },
      { label: 'Notifications', href: '/settings/notifications', icon: Bell },
    ],
  },
  {
    title: 'INTEGRATIONS',
    items: [
      { label: 'Channels', href: '/settings/channels', icon: Plug },
      { label: 'API Keys', href: '/settings/api-keys', icon: Key },
      { label: 'Webhooks', href: '/settings/webhooks', icon: Webhook },
    ],
  },
  {
    title: 'BILLING',
    items: [
      { label: 'Plan & Usage', href: '/settings/billing', icon: CreditCard },
      { label: 'Invoices', href: '/settings/billing#invoices', icon: Receipt },
      { label: 'Payment Method', href: '/settings/billing#payment', icon: CreditCard },
    ],
  },
  {
    title: 'PLATFORM',
    items: [
      { label: 'Appearance', href: '/settings/general#branding', icon: Palette },
      { label: 'Language', href: '/settings/general#regional', icon: Globe },
      { label: 'Data & Privacy', href: '/settings/audit#privacy', icon: Database },
    ],
  },
  {
    title: 'DANGER ZONE',
    items: [
      { label: 'Export Data', href: '/settings/audit#export', icon: Download },
      { label: 'Delete Workspace', href: '/settings/general#danger', icon: Trash2, danger: true },
    ],
  },
]

/** Match pathname + optional hash so sibling links on the same route don't all appear active. */
export function isSettingsNavActive(href: string, pathname: string, hash: string): boolean {
  const [base, fragment] = href.split('#')
  const pathMatches = pathname === base || pathname.startsWith(`${base}/`)
  if (!pathMatches) return false

  if (fragment) return hash === `#${fragment}`
  return hash === '' || hash === '#'
}

function useLocationHash(): string {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [pathname])

  return hash
}

export function SettingsSidebar() {
  const pathname = usePathname()
  const hash = useLocationHash()

  return (
    <nav
      aria-label="Settings"
      className="hidden h-full min-h-0 w-[220px] shrink-0 overflow-y-auto overscroll-contain border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 md:block"
    >
      <div className="p-4 space-y-6">
        {SETTINGS_NAV.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon ?? AlertTriangle
                const active = isSettingsNavActive(item.href, pathname, hash)
                return (
                  <li key={`${section.title}-${item.label}`}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : item.danger
                            ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

export function SettingsMobileNav() {
  const pathname = usePathname()
  const hash = useLocationHash()
  const flat = SETTINGS_NAV.flatMap((s) => s.items)

  return (
    <div className="md:hidden border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-x-auto">
      <div className="flex gap-1 px-3 py-2 min-w-max">
        {flat.slice(0, 10).map((item) => {
          const active = isSettingsNavActive(item.href, pathname, hash)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
