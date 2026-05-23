'use client'

import { create } from 'zustand'

export interface Notification {
  id: string
  title: string
  message?: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  read: boolean
  createdAt: string
}

interface NotificationState {
  unreadCount: number
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  setNotifications: (notifications: Notification[]) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  notifications: [],

  addNotification: (n) =>
    set((s) => {
      const notification: Notification = {
        ...n,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date().toISOString(),
      }
      return {
        notifications: [notification, ...s.notifications],
        unreadCount: s.unreadCount + 1,
      }
    }),

  markRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      if (!target || target.read) return s
      return {
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id)
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.read ? s.unreadCount - 1 : s.unreadCount,
      }
    }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
}))
