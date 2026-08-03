'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CreditCard,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react'
import { PageHeader, Button, Badge, Skeleton, Checkbox } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import type { NotificationDTO } from '@/lib/notifications/types'
import type { NotificationSeverity, NotificationType } from '@prisma/client'

const severityVariant: Record<NotificationSeverity, 'info' | 'warning' | 'danger' | 'success'> = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'danger',
  CRITICAL: 'danger',
}

const typeIcons: Record<NotificationType, typeof Bell> = {
  ALERT: AlertTriangle,
  SYSTEM: Workflow,
  ACTIVITY: Sparkles,
  MENTION: Bell,
  REMINDER: Bell,
  BILLING: CreditCard,
  SECURITY: Shield,
}

const moduleBadge = (n: NotificationDTO): string => {
  const src = (n.metadata?.source as string) ?? n.type
  if (n.type === 'ALERT') return 'AI'
  if (n.type === 'SECURITY') return 'Security'
  if (n.type === 'SYSTEM') return 'Workflow'
  if (n.type === 'BILLING') return 'Billing'
  return src
}

export default function NotificationsPageClient() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [severities, setSeverities] = useState<NotificationSeverity[]>([])
  const [types, setTypes] = useState<NotificationType[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filters = useMemo(
    () => ({
      ...(search ? { search } : {}),
      limit: 50,
    }),
    [search],
  )

  const {
    notifications,
    isLoading,
    markRead,
    markAllRead,
    removeNotification,
    clearRead,
  } = useNotifications(filters)

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (severities.length && !severities.includes(n.severity)) return false
      if (types.length && !types.includes(n.type)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [notifications, severities, types, search])

  const toggleSeverity = (s: NotificationSeverity) => {
    setSeverities((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const toggleType = (t: NotificationType) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkMarkRead() {
    for (const id of selected) await markRead(id)
    setSelected(new Set())
  }

  async function bulkDelete() {
    for (const id of selected) await removeNotification(id)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Notifications"
        subtitle="Alerts, system events, and activity across Cortex"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void clearRead()}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear read
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-100 dark:border-slate-800 p-4 space-y-5 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Search</label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications…"
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <FilterGroup title="Severity">
            {(['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as NotificationSeverity[]).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 py-1">
                <Checkbox checked={severities.includes(s)} onCheckedChange={() => toggleSeverity(s)} />
                {s}
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Type">
            {(['ALERT', 'SYSTEM', 'SECURITY', 'BILLING', 'ACTIVITY'] as NotificationType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 py-1">
                <Checkbox checked={types.includes(t)} onCheckedChange={() => toggleType(t)} />
                {t}
              </label>
            ))}
          </FilterGroup>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-slate-500">{selected.size} selected</span>
              <Button variant="secondary" size="sm" onClick={() => void bulkMarkRead()}>Mark read</Button>
              <Button variant="secondary" size="sm" onClick={() => void bulkDelete()}>Delete</Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Bell className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">You&apos;re all caught up</p>
              </div>
            ) : (
              filtered.map((n) => {
                const Icon = typeIcons[n.type] ?? Bell
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'rounded-xl border p-4 flex gap-3 items-start animate-slideIn',
                      'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
                      !n.isRead && 'ring-1 ring-indigo-100 dark:ring-indigo-900/40',
                    )}
                  >
                    <Checkbox
                      checked={selected.has(n.id)}
                      onCheckedChange={() => toggleSelect(n.id)}
                      className="mt-1"
                    />
                    <Icon className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => {
                        if (!n.isRead) void markRead(n.id)
                        if (n.actionUrl) router.push(n.actionUrl)
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant={severityVariant[n.severity]} size="sm">{n.severity}</Badge>
                        <Badge variant="default" size="sm">{moduleBadge(n)}</Badge>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</span>
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-indigo-500" aria-label="Unread" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <div>{children}</div>
    </div>
  )
}
