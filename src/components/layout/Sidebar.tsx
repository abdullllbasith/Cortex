'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, LogOut, Zap } from 'lucide-react'
import { Avatar, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { useIsTablet, useIsDesktop } from '@/hooks/useIsMobile'
import {
  navSections,
  isNavItemActive,
  type NavItem,
  type NavSection,
} from './nav-config'
import { useTenantBranding } from '@/components/branding/TenantBrandingProvider'
import { useSessionStore } from '@/store/sessionStore'
import { formatUserRole } from '@/lib/auth/displayUser'

/* ─────────────────────────────────────────────────────────────────────────────
   SAIOS Sidebar
   ───────────────────────────────────────────────────────────────────────────── */

export function Sidebar({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()
  const effectiveCollapsed = isTablet || collapsed

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col bg-slate-950 transition-all duration-300 ease-spring',
        'border-r border-slate-800/60',
        effectiveCollapsed ? 'w-[60px]' : 'w-[240px]',
        className,
      )}
    >
      <SidebarLogo collapsed={effectiveCollapsed} />

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scroll-area">
        {navSections.map((section) => (
          <SidebarSection key={section.label} section={section} collapsed={effectiveCollapsed} />
        ))}
      </nav>

      <SidebarUser collapsed={effectiveCollapsed} />

      {isDesktop && !isTablet && (
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center',
            'rounded-full border border-slate-700 bg-slate-800 text-slate-400',
            'hover:bg-slate-700 hover:text-white transition-colors shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      )}
    </aside>
  )
}

/* ── Logo ─────────────────────────────────────────────────────────────────── */

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  const branding = useTenantBranding()
  const tenantName = useSessionStore((s) => s.tenant?.name) ?? branding.name ?? 'Workspace'

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-slate-800/60',
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-4',
      )}
    >
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt=""
          className="h-7 w-7 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          <Zap className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-col leading-none overflow-hidden">
          <span className="font-display text-sm font-semibold text-white tracking-tight truncate">
            SAIOS
          </span>
          <span className="text-[10px] text-slate-500 truncate tracking-wide">
            {tenantName}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Section ──────────────────────────────────────────────────────────────── */

function SidebarSection({
  section,
  collapsed,
}: {
  section: NavSection
  collapsed: boolean
}) {
  return (
    <div className="mb-1">
      {!collapsed && (
        <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none first:mt-1">
          {section.label}
        </p>
      )}
      {collapsed && <div className="my-1 mx-2 h-px bg-slate-800/60" />}
      <ul role="list" className="space-y-0.5 px-2">
        {section.items.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </ul>
    </div>
  )
}

/* ── Nav Item ─────────────────────────────────────────────────────────────── */

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const pathname = usePathname()
  const active = isNavItemActive(item.href, pathname)
  const { icon: Icon, label, badge, placeholder } = item

  const itemContent = (
    <span
      className={cn(
        'group flex h-8 w-full items-center gap-2.5 rounded-md transition-colors duration-100',
        collapsed ? 'justify-center px-2' : 'px-2.5',
        placeholder
          ? 'cursor-not-allowed opacity-40'
          : active
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
        active && !collapsed && 'border-l-2 border-[var(--color-brand)] rounded-l-none pl-[calc(0.625rem-2px)]',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--color-brand-hover)]' : 'text-slate-500 group-hover:text-slate-300')}
        aria-hidden="true"
      />

      {!collapsed && (
        <>
          <span className="flex-1 truncate text-sm font-medium">{label}</span>
          {badge != null && (
            <span
              className={cn(
                'ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                active ? 'bg-[color-mix(in_srgb,var(--color-brand)_30%,transparent)] text-[var(--color-brand-hover)]' : 'bg-slate-700 text-slate-300',
              )}
            >
              {badge}
            </span>
          )}
          {placeholder && (
            <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-slate-600">
              soon
            </span>
          )}
        </>
      )}
    </span>
  )

  if (placeholder) {
    return (
      <li>
        <Tooltip content={collapsed ? `${label} — coming soon` : 'Coming soon'} side="right">
          {itemContent}
        </Tooltip>
      </li>
    )
  }

  if (collapsed) {
    return (
      <li>
        <Tooltip content={label} side="right" delayDuration={200}>
          <Link href={item.href} aria-label={label} aria-current={active ? 'page' : undefined}>
            {itemContent}
          </Link>
        </Tooltip>
      </li>
    )
  }

  return (
    <li>
      <Link href={item.href} aria-current={active ? 'page' : undefined}>
        {itemContent}
      </Link>
    </li>
  )
}

/* ── User footer ──────────────────────────────────────────────────────────── */

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const user = useSessionStore((s) => s.user)
  const displayName = user?.name ?? 'User'
  const roleLabel = formatUserRole(user?.role)

  const handleLogout = () => {
    // TODO: call auth signOut + redirect to /login
    router.push('/login')
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center border-t border-slate-800/60 py-3',
        collapsed ? 'flex-col gap-2 px-2' : 'gap-3 px-3',
      )}
    >
      <Avatar
        name={displayName}
        src={user?.avatarUrl}
        size="sm"
        status="online"
        className="shrink-0"
      />

      {!collapsed && (
        <div className="flex min-w-0 flex-1 flex-col leading-none">
          <span className="truncate text-xs font-semibold text-slate-200">{displayName}</span>
          <span className="truncate text-[10px] text-slate-500">{roleLabel}</span>
        </div>
      )}

      <Tooltip content="Sign out" side={collapsed ? 'right' : 'top'}>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className={cn(
            'shrink-0 rounded-md p-1.5 text-slate-500 transition-colors',
            'hover:bg-slate-800 hover:text-slate-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  )
}
