'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  LifeBuoy,
  Megaphone,
  Flag,
  ScrollText,
  Activity,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/feature-flags', label: 'Feature Flags', icon: Flag },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/health', label: 'Platform Health', icon: Activity },
] as const

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
          <Shield className="h-4 w-4 text-slate-900" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-sm font-bold tracking-wide text-white">SAIOS</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <p className="text-xs text-slate-500">Platform administration</p>
        <p className="mt-0.5 text-[10px] text-slate-600">Restricted access</p>
      </div>
    </aside>
  )
}
