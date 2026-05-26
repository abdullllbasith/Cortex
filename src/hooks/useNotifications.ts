'use client'

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useNotificationStore } from '@/store/notificationStore'
import type { NotificationDTO, SseEvent } from '@/lib/notifications/types'
import { enableNotificationStream } from '@/lib/performance/runtimeFlags'
import { usePageVisible } from '@/hooks/usePageVisible'

export interface NotificationListResponse {
  notifications: NotificationDTO[]
  unreadCount: number
  totalCount: number
}

function buildListPath(filters?: Record<string, unknown>): string {
  if (!filters) return '/notifications'
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `/notifications?${qs}` : '/notifications'
}

function playCriticalTone() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.05
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close(), 300)
  } catch {
    /* optional */
  }
}

async function registerPush() {
  if (!('serviceWorker' in navigator)) return
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted' || !('PushManager' in window)) return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    })
    const json = sub.toJSON()
    await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    })
  } catch {
    /* push optional */
  }
}

/** Single SSE + push registration — mount once in NotificationProvider */
export function useNotificationStream() {
  const visible = usePageVisible()
  const prependNotification = useNotificationStore((s) => s.prependNotification)
  const markAllReadLocal = useNotificationStore((s) => s.markAllRead)
  const setLatestCritical = useNotificationStore((s) => s.setLatestCritical)

  useEffect(() => {
    if (!enableNotificationStream() || !visible) return

    const es = new EventSource('/api/notifications/stream', { withCredentials: true })

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SseEvent
        if (parsed.type === 'notification') {
          prependNotification(parsed.payload)
          if (parsed.payload.severity === 'CRITICAL') {
            setLatestCritical(true)
            playCriticalTone()
            setTimeout(() => setLatestCritical(false), 5000)
          }
        } else if (parsed.type === 'read_all') {
          markAllReadLocal()
        }
      } catch {
        /* ignore */
      }
    }

    return () => es.close()
  }, [visible, prependNotification, markAllReadLocal, setLatestCritical])

  useEffect(() => {
    if (!enableNotificationStream()) return
    void registerPush()
  }, [])
}

export function useNotifications(
  filters?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const latestCritical = useNotificationStore((s) => s.latestCritical)
  const setNotifications = useNotificationStore((s) => s.setNotifications)
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const markReadLocal = useNotificationStore((s) => s.markRead)
  const markAllReadLocal = useNotificationStore((s) => s.markAllRead)
  const removeLocal = useNotificationStore((s) => s.removeNotification)

  const { data, mutate, isLoading } = useSWR<NotificationListResponse>(
    enabled ? queryKeys.notifications.list(filters) : null,
    () => swrFetcher<NotificationListResponse>(buildListPath(filters)),
  )

  useEffect(() => {
    if (!data) return
    setNotifications(data.notifications)
    setUnreadCount(data.unreadCount)
  }, [data, setNotifications, setUnreadCount])

  const markRead = useCallback(
    async (id: string) => {
      markReadLocal(id)
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' })
      void mutate()
    },
    [markReadLocal, mutate],
  )

  const markAllRead = useCallback(async () => {
    markAllReadLocal()
    await fetch('/api/notifications/read-all', { method: 'PATCH', credentials: 'include' })
    void mutate()
  }, [markAllReadLocal, mutate])

  const removeNotification = useCallback(
    async (id: string) => {
      removeLocal(id)
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' })
      void mutate()
    },
    [removeLocal, mutate],
  )

  const clearRead = useCallback(async () => {
    await fetch('/api/notifications/clear', { method: 'DELETE', credentials: 'include' })
    void mutate()
  }, [mutate])

  return {
    notifications,
    unreadCount,
    latestCritical,
    isLoading,
    mutate,
    markRead,
    markAllRead,
    removeNotification,
    clearRead,
  }
}

/** Lightweight unread badge — deferred so it does not block first paint. */
export function useNotificationUnreadBadge() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const run = () => setEnabled(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 2000)
    return () => clearTimeout(t)
  }, [])

  const { data } = useSWR<NotificationListResponse>(
    enabled ? '/notifications?limit=1' : null,
    () => swrFetcher<NotificationListResponse>('/notifications?limit=1'),
    { dedupingInterval: 60_000 },
  )

  useEffect(() => {
    if (data) setUnreadCount(data.unreadCount)
  }, [data, setUnreadCount])

  return unreadCount
}
