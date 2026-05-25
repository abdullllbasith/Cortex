'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { navSections, isNavItemActive, type NavItem } from './nav-config'
import { useSessionStore } from '@/store/sessionStore'
import { formatUserRole } from '@/lib/auth/displayUser'
import { useReorderSuggestionCount } from '@/hooks/useReorderSuggestionCount'

/* ─────────────────────────────────────────────────────────────────────────────
   MobileSidebar — full-screen overlay drawer for screens < md
   ───────────────────────────────────────────────────────────────────────────── */

export function MobileSidebar() {
  const { mobileOpen, closeMobile } = useSidebar()
  const pathname = usePathname()
  const user = useSessionStore((s) => s.user)
  const displayName = user?.name ?? 'User'
  const roleLabel = formatUserRole(user?.role)
  const reorderCount = useReorderSuggestionCount()

  return (
    <DialogPrimitive.Root open={mobileOpen} onOpenChange={(o) => !o && closeMobile()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden',
            'data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut',
          )}
        />

        <DialogPrimitive.Content
          aria-label="Navigation"
          className={cn(
            'fixed inset-0 z-40 flex flex-col md:hidden',
            'bg-slate-950 shadow-xl',
            'data-[state=open]:animate-slideInLeft',
            'focus:outline-none',
          )}
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/60 px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                <Zap className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-sm font-semibold text-white">SAIOS</span>
                <span className="text-[10px] text-slate-500">Acme Corporation</span>
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label="Close navigation"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                'text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 scroll-area">
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

          {/* User footer */}
          <div className="flex shrink-0 items-center gap-3 border-t border-slate-800/60 px-3 py-3">
            <Avatar name={displayName} src={user?.avatarUrl} size="sm" status="online" />
            <div className="flex min-w-0 flex-1 flex-col leading-none">
              <span className="truncate text-xs font-semibold text-slate-200">{displayName}</span>
              <span className="truncate text-[10px] text-slate-500">{roleLabel}</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
