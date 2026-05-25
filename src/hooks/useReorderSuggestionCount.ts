'use client'

import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'

interface ReorderCountResponse {
  count: number
  lastCheckedAt: string | null
}

export function useReorderSuggestionCount(): number {
  const { data } = useSWR<ReorderCountResponse>(
    '/inventory/reorder?countOnly=true',
    swrFetcher,
    { refreshInterval: 60_000 },
  )
  return data?.count ?? 0
}
