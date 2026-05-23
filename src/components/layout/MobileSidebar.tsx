'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { navSections, isNavItemActive, type NavItem } from './nav-config'

/* ─────────────────────────────────────────────────────────────────────────────
   MobileSidebar — overlay drawer for screens < lg
   ───────────────────────────────────────────────────────────────────────────── */

export function MobileSidebar() {
  const { mobileOpen, closeMobile } = useSidebar()
  const pathname = usePathname()

  return (
    <DialogPrimitive.Root open={mobileOpen} onOpenChange={(o) => !o && closeMobile()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden',
            'data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut',
          )}
        />

        {/* Drawer panel — slides in from left */}
        <DialogPrimitive.Content
          aria-label="Navigation"
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col lg:hidden',
            'bg-slate-950 border-r border-slate-800/60 shadow-xl',
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
                  {section.items.map((item) => (
                    <MobileNavItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onSelect={closeMobile}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="flex shrink-0 items-center gap-3 border-t border-slate-800/60 px-3 py-3">
            <Avatar name="Abdul Basith" size="sm" status="online" />
            <div className="flex min-w-0 flex-1 flex-col leading-none">
              <span className="truncate text-xs font-semibold text-slate-200">Abdul Basith</span>
              <span className="truncate text-[10px] text-slate-500">Administrator</span>
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
  const { icon: Icon, label, badge, placeholder } = item

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
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-700 px-1 text-[10px] font-semibold text-slate-300">
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
