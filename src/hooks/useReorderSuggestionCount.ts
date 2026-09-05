'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import { PERMISSIONS } from '@/lib/auth/permissions'

interface ReorderCountResponse {
  count: number
  lastCheckedAt: string | null
}

export function useReorderSuggestionCount(): number {
  const [enabled, setEnabled] = useState(false)
  const canViewInventory = useSessionStore((s) => s.hasPermission(PERMISSIONS.INVENTORY_VIEW))

  useEffect(() => {
    if (typeof window === 'undefined' || !canViewInventory) return
    const run = () => setEnabled(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 1500)
    return () => clearTimeout(t)
  }, [canViewInventory])

  const { data } = useSWR<ReorderCountResponse>(
    enabled && canViewInventory ? '/inventory/reorder?countOnly=true' : null,
    swrFetcher,
    { refreshInterval: 120_000, dedupingInterval: 60_000 },
  )
  return data?.count ?? 0
}
