'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  LayoutDashboard, Bot, BookOpen, Cpu, BarChart3, TrendingUp,
  GitBranch, Settings, Bell, CreditCard, Search, ArrowRight,
  Zap, FileText, Users, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────────
   CommandPalette — ⌘K global search
   ───────────────────────────────────────────────────────────────────────────── */

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* Navigation shortcuts */
const navItems = [
  { label: 'Dashboard',      href: '/dashboard',     icon: LayoutDashboard },
  { label: 'AI Assistant',   href: '/assistant',       icon: Bot },
  { label: 'Knowledge Base', href: '/knowledge',       icon: BookOpen },
  { label: 'Agents',         href: '/agents',          icon: Cpu },
  { label: 'Analytics',      href: '/analytics',       icon: BarChart3 },
  { label: 'Predictions',    href: '/predictions',     icon: TrendingUp },
  { label: 'Workflows',      href: '/workflows',       icon: GitBranch },
  { label: 'Alerts',         href: '/alerts',          icon: Bell },
  { label: 'Settings',       href: '/settings',        icon: Settings },
  { label: 'Billing',        href: '/settings/billing',icon: CreditCard },
] as const

/* Quick action shortcuts */
const actionItems = [
  { label: 'New workflow',   icon: Zap,      action: 'new-workflow' },
  { label: 'Upload document',icon: FileText, action: 'upload-doc' },
  { label: 'Invite teammate',icon: Users,    action: 'invite' },
  { label: 'View reports',   icon: BarChart2,action: 'reports' },
] as const

/* Recent (would be fetched from API / localStorage in production) */
const recentItems = [
  { label: 'Customer #4421 — Acme Inc',  href: '/knowledge/customers/4421' },
  { label: 'Invoice workflow — Oct 2025', href: '/workflows/invoice-oct' },
  { label: 'Sales analytics report',     href: '/analytics/sales' },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [onOpenChange, router],
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut" />

        {/* Panel */}
        <DialogPrimitive.Content
          aria-label="Command palette"
          className={cn(
            'fixed left-1/2 top-[15vh] z-50 w-full max-w-[560px] -translate-x-1/2',
            'rounded-xl border bg-white shadow-xl dark:bg-slate-900 dark:border-slate-800',
            'border-slate-200',
            'data-[state=open]:animate-scaleIn data-[state=closed]:animate-scaleOut',
            'overflow-hidden',
          )}
        >
          <Command shouldFilter loop className="flex flex-col">
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <Command.Input
                placeholder="Search pages, actions, or customers…"
                className={cn(
                  'flex-1 bg-transparent py-3.5 text-sm outline-none',
                  'text-slate-900 placeholder:text-slate-400',
                  'dark:text-slate-100 dark:placeholder:text-slate-500',
                )}
              />
              <kbd className="flex shrink-0 items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <Command.List className="max-h-[380px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No results found.
              </Command.Empty>

              {/* Navigation group */}
              <Command.Group
                heading="Navigation"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-400 dark:[&_[cmdk-group-heading]]:text-slate-500"
              >
                {navItems.map(({ label, href, icon: Icon }) => (
                  <Command.Item
                    key={href}
                    value={`nav-${label}`}
                    onSelect={() => navigate(href)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                      'text-slate-700 dark:text-slate-300',
                      'data-[selected=true]:bg-indigo-50 data-[selected=true]:text-indigo-900',
                      'dark:data-[selected=true]:bg-indigo-950/50 dark:data-[selected=true]:text-indigo-100',
                      'transition-colors outline-none',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                      <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    </div>
                    <span className="flex-1">{label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator className="my-2 h-px bg-slate-100 dark:bg-slate-800" />

              {/* Recent group */}
              <Command.Group
                heading="Recent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-400 dark:[&_[cmdk-group-heading]]:text-slate-500"
              >
                {recentItems.map(({ label, href }) => (
                  <Command.Item
                    key={href}
                    value={`recent-${label}`}
                    onSelect={() => navigate(href)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                      'text-slate-700 dark:text-slate-300',
                      'data-[selected=true]:bg-indigo-50 data-[selected=true]:text-indigo-900',
                      'dark:data-[selected=true]:bg-indigo-950/50 dark:data-[selected=true]:text-indigo-100',
                      'transition-colors outline-none',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold">
                      ↩
                    </div>
                    <span className="flex-1 truncate">{label}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator className="my-2 h-px bg-slate-100 dark:bg-slate-800" />

              {/* Actions group */}
              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-400 dark:[&_[cmdk-group-heading]]:text-slate-500"
              >
                {actionItems.map(({ label, icon: Icon, action }) => (
                  <Command.Item
                    key={action}
                    value={`action-${label}`}
                    onSelect={() => onOpenChange(false)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                      'text-slate-700 dark:text-slate-300',
                      'data-[selected=true]:bg-indigo-50 data-[selected=true]:text-indigo-900',
                      'dark:data-[selected=true]:bg-indigo-950/50 dark:data-[selected=true]:text-indigo-100',
                      'transition-colors outline-none',
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/40">
                      <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    </div>
                    <span className="flex-1">{label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 dark:border-slate-800">
              <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-600">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">esc</kbd>
                  close
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-600">
                <Zap className="h-3 w-3" aria-hidden="true" /> SAIOS
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
