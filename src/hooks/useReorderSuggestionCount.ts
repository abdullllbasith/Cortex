'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'

interface ReorderCountResponse {
  count: number
  lastCheckedAt: string | null
}

export function useReorderSuggestionCount(): number {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const run = () => setEnabled(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 1500)
    return () => window.clearTimeout(t)
  }, [])

  const { data } = useSWR<ReorderCountResponse>(
    enabled ? '/inventory/reorder?countOnly=true' : null,
    swrFetcher,
    { refreshInterval: 120_000, dedupingInterval: 60_000 },
  )
  return data?.count ?? 0
}
