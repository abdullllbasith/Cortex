'use client'

import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AlertTriangle, Bell, Info, XCircle } from 'lucide-react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { swrFetcher } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useMutateAlerts } from '@/lib/api/hooks/useAlerts'

interface AlertItem {
  id: string
  title: string
  message: string
  severity: 'danger' | 'warning' | 'info'
  rawSeverity?: string
  read: boolean
  createdAt: string
}

const severityIcon = {
  danger: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const severityColor = {
  danger: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

export function AlertBell() {
  const router = useRouter()
  const { data: alerts = [] } = useSWR<AlertItem[]>(
    queryKeys.alerts.list(false),
    () => swrFetcher('/alerts?limit=20'),
  )
  const { markRead } = useMutateAlerts()

  const unread = alerts.filter((a) => !a.read)
  const unreadCount = unread.length
  const latest = alerts.slice(0, 5)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`${unreadCount} unread notifications`}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          )}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 w-80 rounded-xl border p-1 shadow-lg',
            'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800',
          )}
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alerts</p>
            <p className="text-xs text-slate-500">{unreadCount} unread</p>
          </div>

          {latest.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">No alerts</p>
          ) : (
            latest.map((alert) => {
              const Icon = severityIcon[alert.severity] ?? Info
              return (
                <DropdownMenu.Item
                  key={alert.id}
                  className={cn(
                    'flex gap-2 rounded-md px-3 py-2 text-xs outline-none cursor-pointer',
                    'data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-800',
                    !alert.read && 'bg-slate-50/50 dark:bg-slate-800/30',
                  )}
                  onSelect={() => {
                    if (!alert.read) markRead.trigger(alert.id)
                    router.push('/alerts')
                  }}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', severityColor[alert.severity])} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{alert.title}</p>
                    <p className="text-slate-500 line-clamp-2">{alert.message}</p>
                  </div>
                </DropdownMenu.Item>
              )
            })
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <DropdownMenu.Item
            className="px-3 py-2 text-xs font-medium text-indigo-600 cursor-pointer outline-none data-[highlighted]:bg-indigo-50 dark:data-[highlighted]:bg-indigo-950/30 rounded-md"
            onSelect={() => router.push('/alerts')}
          >
            View all alerts
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
