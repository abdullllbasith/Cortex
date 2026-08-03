'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Menu,
  Search,
  User,
  Settings,
  LogOut,
} from 'lucide-react'
import { Avatar, Badge } from '@/components/ui'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { TenantLogoMark } from '@/components/branding/TenantLogoMark'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { useIsMobile } from '@/hooks/useIsMobile'
import { getTitleFromPathname } from './nav-config'
import { LazyCommandPalette } from '@/lib/lazy/components'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { useSessionStore } from '@/store/sessionStore'
import { signOutUser } from '@/lib/auth/signOut'
import { formatUserRole } from '@/lib/auth/displayUser'
import { useDashboardGreeting } from '@/hooks/useDashboardGreeting'

export function TopBar() {
  const pathname = usePathname()
  const { openMobile } = useSidebar()
  const isMobile = useIsMobile()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdFullscreen, setCmdFullscreen] = useState(false)
  const title = getTitleFromPathname(pathname)
  const isDashboard = pathname === '/dashboard'
  const { greeting, dateStr } = useDashboardGreeting()
  const user = useSessionStore((s) => s.user)
  const firstName = user?.name?.split(/\s+/)[0] ?? 'there'

  const openSearch = (fullscreen: boolean) => {
    setCmdFullscreen(fullscreen)
    setCmdOpen(true)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
        {isMobile ? (
          <>
            <button
              type="button"
              aria-label="Open navigation"
              onClick={openMobile}
              className={cn(
                'flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-md',
                'text-slate-500 transition-transform duration-100 active:scale-95',
                'hover:bg-slate-100 hover:text-slate-900',
                'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              )}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link
              href="/dashboard"
              className="flex min-w-0 flex-1 items-center justify-center"
              aria-label="Dashboard home"
            >
              <TenantLogoMark showLabels={false} variant="light" />
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => openSearch(true)}
                aria-label="Search"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                )}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
              <NotificationDropdown />
              <UserMenu />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {isDashboard ? (
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {greeting}, {firstName} 👋
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{dateStr}</p>
                </div>
              ) : (
                <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {title}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => openSearch(false)}
              aria-label="Open command palette (⌘K)"
              className={cn(
                'hidden sm:flex items-center gap-2 rounded-md border px-3 h-8 text-xs',
                'border-slate-200 bg-slate-50 text-slate-500',
                'hover:border-slate-300 hover:bg-white hover:text-slate-900',
                'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
                'dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              )}
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Search or jump to…</span>
              <kbd className="hidden md:flex items-center gap-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                <span>⌘</span>K
              </kbd>
            </button>

            <div className="flex items-center gap-1">
              <NotificationDropdown />
              <ThemeToggle />
              <UserMenu />
            </div>
          </>
        )}
      </header>

      {cmdOpen ? (
        <LazyCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} fullScreen={cmdFullscreen} />
      ) : null}
    </>
  )
}

const menuItemCls = cn(
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none',
  'text-slate-700 dark:text-slate-300',
  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
  'dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-slate-100',
  'transition-colors',
)

function UserMenu() {
  const router = useRouter()
  const user = useSessionStore((s) => s.user)
  const displayName = user?.name ?? 'User'
  const displayEmail = user?.email ?? ''
  const roleLabel = formatUserRole(user?.role)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="User menu"
          className={cn(
            'ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-opacity',
            'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          )}
        >
          <Avatar name={displayName} src={user?.avatarUrl} size="sm" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 min-w-[200px] rounded-xl border p-1.5 shadow-lg',
            'bg-white dark:bg-slate-900',
            'border-slate-100 dark:border-slate-800',
            'animate-scaleIn',
          )}
        >
          <div className="mb-1 flex items-center gap-2.5 px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
            <Avatar name={displayName} src={user?.avatarUrl} size="sm" status="online" />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
              <span className="text-xs text-slate-500">{displayEmail}</span>
            </div>
            <Badge variant="success" size="sm" className="ml-auto">{roleLabel}</Badge>
          </div>

          <DropdownMenu.Item className={menuItemCls} onSelect={() => router.push('/settings/profile')}>
            <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item className={menuItemCls} onSelect={() => router.push('/settings/general')}>
            <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          <DropdownMenu.Item
            className={cn(menuItemCls, 'text-red-600 dark:text-red-400 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:data-[highlighted]:bg-red-950/40')}
            onSelect={() => void signOutUser(router)}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
