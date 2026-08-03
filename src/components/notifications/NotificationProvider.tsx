'use client'

import { NotificationToastStack } from '@/components/notifications/NotificationToast'
import { useNotificationStream } from '@/hooks/useNotifications'

/** Mounts SSE-driven toast stack inside dashboard layout */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useNotificationStream()
  return (
    <>
      {children}
      <NotificationToastStack />
    </>
  )
}
