'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Info,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useNotificationUnreadBadge, useNotifications } from '@/hooks/useNotifications'
import type { NotificationDTO } from '@/lib/notifications/types'
import type { NotificationType } from '@prisma/client'
import type { NotificationSeverity } from '@prisma/client'

type FilterTab = 'all' | 'unread' | 'alerts' | 'system'

const severityBorder: Record<NotificationSeverity, string> = {
  INFO: 'border-l-blue-500',
  WARNING: 'border-l-amber-500',
  ERROR: 'border-l-red-500',
  CRITICAL: 'border-l-red-600',
}

const typeIcons: Record<NotificationType, typeof Bell> = {
  ALERT: AlertTriangle,
  SYSTEM: Workflow,
  ACTIVITY: Sparkles,
  MENTION: Info,
  REMINDER: Bell,
  BILLING: CreditCard,
  SECURITY: Shield,
}

export function NotificationDropdown() {
  const router = useRouter()
  const [tab, setTab] = useState<FilterTab>('all')
  const [open, setOpen] = useState(false)
  const badgeUnread = useNotificationUnreadBadge()
  const { notifications, unreadCount, latestCritical, markRead, markAllRead } = useNotifications(
    undefined,
    { enabled: open },
  )
  const displayUnread = open ? unreadCount : badgeUnread

  const filtered = useMemo(() => {
    switch (tab) {
      case 'unread':
        return notifications.filter((n) => !n.isRead)
      case 'alerts':
        return notifications.filter((n) => n.type === 'ALERT')
      case 'system':
        return notifications.filter((n) => n.type === 'SYSTEM' || n.type === 'SECURITY')
      default:
        return notifications
    }
  }, [notifications, tab])

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'system', label: 'System' },
  ]

  return (
    <DropdownMenu.Root onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`${displayUnread} unread notifications`}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          {latestCritical && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-md animate-ping ring-2 ring-red-500/60"
            />
          )}
          <Bell className="h-4 w-4" aria-hidden="true" />
          {displayUnread > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full',
                'bg-red-500 px-1 text-[10px] font-bold text-white animate-scaleIn',
              )}
            >
              {displayUnread > 99 ? '99+' : displayUnread}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 w-[380px] rounded-xl border shadow-lg overflow-hidden',
            'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800',
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
            {displayUnread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">You&apos;re all caught up</p>
              </div>
            ) : (
              filtered.slice(0, 20).map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onOpen={() => {
                    if (!n.isRead) void markRead(n.id)
                    if (n.actionUrl) router.push(n.actionUrl)
                  }}
                />
              ))
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 p-2">
            <Link
              href="/notifications"
              className="block rounded-md px-3 py-2 text-center text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              View all notifications
            </Link>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function NotificationRow({
  notification: n,
  onOpen,
}: {
  notification: NotificationDTO
  onOpen: () => void
}) {
  const Icon = typeIcons[n.type] ?? Info
  const isCritical = n.severity === 'CRITICAL' || n.severity === 'ERROR'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full text-left flex gap-3 px-4 py-3 border-l-4 border-b border-b-slate-50 dark:border-b-slate-800/50',
        severityBorder[n.severity],
        !n.isRead && 'bg-slate-50/80 dark:bg-slate-800/30',
        'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0 mt-0.5', isCritical ? 'text-red-500' : 'text-slate-400')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
          {!n.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
          )}
        </div>
        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.body}</p>
        <p className="text-[10px] text-slate-400 mt-1">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  )
}

export function AlertBell() {
  return <NotificationDropdown />
}
