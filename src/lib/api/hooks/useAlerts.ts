'use client'

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { apiClient } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Alert } from '@/lib/api/types'

export function useAlerts(unreadOnly = false) {
  return useSWR<Alert[]>(
    queryKeys.alerts.list(unreadOnly),
    () => apiClient.get<Alert[]>('/alerts', { params: { unreadOnly } }),
  )
}

export function useMutateAlerts() {
  const markRead = useSWRMutation(
    queryKeys.alerts.all,
    (_key, { arg }: { arg: string }) =>
      apiClient.patch<void>(`/alerts/${arg}/read`),
  )

  const markAllRead = useSWRMutation(
    queryKeys.alerts.all,
    () => apiClient.post<void>('/alerts/read-all'),
  )

  return { markRead, markAllRead }
}
