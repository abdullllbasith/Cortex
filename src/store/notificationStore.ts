'use client'

import { create } from 'zustand'
import type { NotificationDTO } from '@/lib/notifications/types'

interface NotificationState {
  unreadCount: number
  notifications: NotificationDTO[]
  latestCritical: boolean
  setUnreadCount: (count: number) => void
  setNotifications: (notifications: NotificationDTO[]) => void
  prependNotification: (n: NotificationDTO) => void
  markRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  setLatestCritical: (value: boolean) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  notifications: [],
  latestCritical: false,

  setUnreadCount: (count) => set({ unreadCount: count }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  prependNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)].slice(0, 100),
      unreadCount: n.isRead ? s.unreadCount : s.unreadCount + 1,
      latestCritical: n.severity === 'CRITICAL',
    })),

  markRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      if (!target || target.isRead) return s
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
      latestCritical: false,
    })),

  removeNotification: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.isRead ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      }
    }),

  setLatestCritical: (value) => set({ latestCritical: value }),
}))
