'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/store/notificationStore'
import type { NotificationDTO } from '@/lib/notifications/types'
import type { NotificationSeverity } from '@prisma/client'

const borderColor: Record<NotificationSeverity, string> = {
  INFO: 'border-l-blue-500',
  WARNING: 'border-l-amber-500',
  ERROR: 'border-l-red-500',
  CRITICAL: 'border-l-red-600',
}

interface ToastItem extends NotificationDTO {
  toastId: string
}

export function NotificationToastStack() {
  const notifications = useNotificationStore((s) => s.notifications)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [seen, setSeen] = useState<Set<string>>(new Set())

  useEffect(() => {
    const latest = notifications[0]
    if (!latest || seen.has(latest.id)) return
    setSeen((prev) => new Set(prev).add(latest.id))
    setToasts((prev) => [{ ...latest, toastId: latest.id }, ...prev].slice(0, 3))
  }, [notifications, seen])

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) => {
      const ms = t.severity === 'CRITICAL' ? 10_000 : 5_000
      if (t.severity === 'CRITICAL') return null
      return setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId))
      }, ms)
    })
    return () => timers.forEach((t) => t && clearTimeout(t))
  }, [toasts])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[340px] pointer-events-none">
      {toasts.map((t, i) => (
        <div
          key={t.toastId}
          className={cn(
            'pointer-events-auto rounded-lg border bg-white dark:bg-slate-900 shadow-lg border-l-4 p-3',
            borderColor[t.severity],
            t.severity === 'CRITICAL' && 'animate-pulse',
            i > 0 && 'scale-[0.97] opacity-90',
            i > 1 && 'scale-[0.94] opacity-75',
          )}
          style={{ transform: `translateY(${i * -4}px)` }}
        >
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{t.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((x) => x.toastId !== t.toastId))}
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
