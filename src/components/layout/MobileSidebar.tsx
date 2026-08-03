'use client'

import { useEffect } from 'react'
import { LogOut, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { navSections, isNavItemActive, type NavItem } from './nav-config'
import { TenantLogoMark } from '@/components/branding/TenantLogoMark'
import { useSessionStore } from '@/store/sessionStore'
import { formatUserRole } from '@/lib/auth/displayUser'
import { signOutUser } from '@/lib/auth/signOut'
import { useReorderSuggestionCount } from '@/hooks/useReorderSuggestionCount'

const DRAWER_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/* ─────────────────────────────────────────────────────────────────────────────
   MobileSidebar — full-screen overlay drawer for screens < md
   ───────────────────────────────────────────────────────────────────────────── */

export function MobileSidebar() {
  const router = useRouter()
  const { mobileOpen, closeMobile } = useSidebar()
  const pathname = usePathname()
  const user = useSessionStore((s) => s.user)
  const displayName = user?.name ?? 'User'
  const roleLabel = formatUserRole(user?.role)
  const reorderCount = useReorderSuggestionCount()

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen, closeMobile])

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 md:hidden',
        mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!mobileOpen}
    >
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={closeMobile}
        className={cn(
          'absolute inset-0 bg-black/55',
          'transition-opacity duration-200 ease-out',
          mobileOpen ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          'absolute inset-y-0 left-0 flex w-full max-w-[min(100%,20rem)] flex-col bg-slate-950 shadow-xl',
          'will-change-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          transition: mobileOpen
            ? `transform 240ms ${DRAWER_EASE}`
            : `transform 200ms ${DRAWER_EASE}`,
        }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/60 px-4">
          <TenantLogoMark variant="dark" />

          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobile}
            className={cn(
              'flex h-8 w-8 touch-manipulation items-center justify-center rounded-md',
              'text-slate-500 transition-transform duration-100 active:scale-95',
              'hover:bg-slate-800 hover:text-slate-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="scroll-area scroll-area-dark flex-1 overflow-y-auto py-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none first:mt-1">
                {section.label}
              </p>
              <ul role="list" className="space-y-0.5 px-2">
                {section.items.map((item) => {
                  const withBadge =
                    item.href === '/inventory/reorder' && reorderCount > 0
                      ? {
                          ...item,
                          badge: reorderCount > 99 ? '99+' : reorderCount,
                          badgeVariant: 'danger' as const,
                        }
                      : item
                  return (
                    <MobileNavItem
                      key={item.href}
                      item={withBadge}
                      pathname={pathname}
                      onSelect={closeMobile}
                    />
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-slate-800/60 px-3 py-3">
          <Avatar name={displayName} src={user?.avatarUrl} size="sm" status="online" />
          <div className="flex min-w-0 flex-1 flex-col leading-none">
            <span className="truncate text-xs font-semibold text-slate-200">{displayName}</span>
            <span className="truncate text-[10px] text-slate-500">{roleLabel}</span>
          </div>
          <Tooltip content="Sign out" side="top">
            <button
              type="button"
              onClick={() => void signOutUser(router)}
              aria-label="Sign out"
              className={cn(
                'shrink-0 rounded-md p-1.5 text-slate-500 transition-colors',
                'hover:bg-slate-800 hover:text-red-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

/* ── Mobile Nav Item ──────────────────────────────────────────────────────── */

function MobileNavItem({
  item,
  pathname,
  onSelect,
}: {
  item: NavItem
  pathname: string
  onSelect: () => void
}) {
  const active = isNavItemActive(item.href, pathname)
  const { icon: Icon, label, badge, badgeVariant, placeholder } = item

  const content = (
    <span
      className={cn(
        'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 transition-colors duration-100',
        placeholder
          ? 'cursor-not-allowed opacity-40'
          : active
            ? 'border-l-2 border-indigo-500 bg-slate-800 pl-[calc(0.625rem-2px)] text-white rounded-l-none'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')}
        aria-hidden="true"
      />
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      {badge != null && (
        <span
          className={cn(
            'ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
            badgeVariant === 'danger' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300',
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
    </span>
  )

  if (placeholder) {
    return (
      <li>
        <Tooltip content="Coming soon" side="right">{content}</Tooltip>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
      >
        {content}
      </Link>
    </li>
  )
}
