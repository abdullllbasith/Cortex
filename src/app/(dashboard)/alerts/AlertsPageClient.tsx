'use client'

import { AlertTriangle, CheckCheck } from 'lucide-react'
import { PageHeader, Button, Badge, Skeleton } from '@/components/ui'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useMutateAlerts } from '@/lib/api/hooks/useAlerts'
import { cn } from '@/lib/utils'

interface AlertItem {
  id: string
  title: string
  message: string
  type: string
  severity: 'danger' | 'warning' | 'info'
  rawSeverity?: string
  read: boolean
  createdAt: string
}

const severityVariant = {
  danger: 'danger' as const,
  warning: 'warning' as const,
  info: 'info' as const,
}

export default function AlertsPageClient() {
  const { data: alerts = [], isLoading, mutate } = useSWR<AlertItem[]>(
    queryKeys.alerts.list(false),
    () => swrFetcher('/alerts'),
  )
  const { markRead, markAllRead } = useMutateAlerts()

  async function dismiss(id: string) {
    await markRead.trigger(id)
    mutate()
  }

  async function dismissAll() {
    await markAllRead.trigger()
    mutate()
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Alerts"
        subtitle="System notifications, anomaly alerts, and action items"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Alerts' }]}
        actions={
          <Button variant="secondary" size="sm" onClick={dismissAll}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-3 overflow-y-auto">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No alerts — you&apos;re all caught up</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-xl border p-4 flex gap-4',
                alert.read
                  ? 'border-slate-200 dark:border-slate-700 opacity-70'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{alert.title}</span>
                  <Badge variant={severityVariant[alert.severity]} size="sm">{alert.rawSeverity ?? alert.severity}</Badge>
                  <Badge variant="default" size="sm">{alert.type}</Badge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{alert.message}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
              {!alert.read && (
                <Button variant="secondary" size="sm" onClick={() => dismiss(alert.id)}>Dismiss</Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
