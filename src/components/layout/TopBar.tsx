'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { Avatar, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/lib/sidebar-context'
import { getTitleFromPathname } from './nav-config'
import { CommandPalette } from './CommandPalette'

/* ─────────────────────────────────────────────────────────────────────────────
   SAIOS TopBar
   ───────────────────────────────────────────────────────────────────────────── */

export function TopBar() {
  const pathname = usePathname()
  const { openMobile } = useSidebar()
  const [cmdOpen, setCmdOpen] = useState(false)
  const title = getTitleFromPathname(pathname)

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={openMobile}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md lg:hidden',
            'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Page title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
        </div>

        {/* ⌘K trigger */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
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

        {/* Right cluster */}
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  )
}

/* ── Notification Bell ────────────────────────────────────────────────────── */

function NotificationBell() {
  const router = useRouter()
  const unread = 3 // TODO: fetch from API

  return (
    <button
      type="button"
      aria-label={`${unread} unread notifications`}
      onClick={() => router.push('/alerts')}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      )}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

/* ── Theme Toggle ─────────────────────────────────────────────────────────── */

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-8 w-8" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  )
}

/* ── User Dropdown Menu ───────────────────────────────────────────────────── */

const menuItemCls = cn(
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none',
  'text-slate-700 dark:text-slate-300',
  'data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
  'dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-slate-100',
  'transition-colors',
)

function UserMenu() {
  const router = useRouter()

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
          <Avatar name="Abdul Basith" size="sm" />
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
          {/* User info header */}
          <div className="mb-1 flex items-center gap-2.5 px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
            <Avatar name="Abdul Basith" size="sm" status="online" />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Abdul Basith</span>
              <span className="text-xs text-slate-500">admin@acme.com</span>
            </div>
            <Badge variant="success" size="sm" className="ml-auto">Admin</Badge>
          </div>

          <DropdownMenu.Item
            className={menuItemCls}
            onSelect={() => router.push('/settings')}
          >
            <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={menuItemCls}
            onSelect={() => router.push('/settings/general')}
          >
            <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

          <DropdownMenu.Item
            className={cn(menuItemCls, 'text-red-600 dark:text-red-400 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:data-[highlighted]:bg-red-950/40')}
            onSelect={() => router.push('/login')}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
