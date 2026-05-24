'use client'

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/api/apiClient'
import { useSessionStore } from '@/store/sessionStore'
import type { ExecutiveData } from './types'

const EXECUTIVE_DASHBOARD_PATH = '/analytics/executive?period=week'

interface ExecutiveDashboardContextValue {
  data: ExecutiveData | undefined
  isLoading: boolean
  isValidating: boolean
  error: Error | undefined
  mutate: () => Promise<ExecutiveData | undefined>
}

const ExecutiveDashboardContext = createContext<ExecutiveDashboardContextValue | null>(null)

export function ExecutiveDashboardProvider({ children }: { children: ReactNode }) {
  const tenantId = useSessionStore((s) => s.tenant?.id)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ExecutiveData>(
    tenantId ? (['executive-dashboard', tenantId] as const) : null,
    () => apiClient.get<ExecutiveData>(EXECUTIVE_DASHBOARD_PATH),
    {
      dedupingInterval: 60_000,
      refreshInterval: 120_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  )

  const value = useMemo<ExecutiveDashboardContextValue>(
    () => ({
      data,
      isLoading: !tenantId || isLoading,
      isValidating,
      error: error as Error | undefined,
      mutate: async () => {
        const result = await mutate()
        return result
      },
    }),
    [data, error, isLoading, isValidating, mutate, tenantId],
  )

  return (
    <ExecutiveDashboardContext.Provider value={value}>
      {error && !isLoading && (
        <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Dashboard data could not be loaded.{' '}
          <button
            type="button"
            onClick={() => void mutate()}
            className="font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </ExecutiveDashboardContext.Provider>
  )
}

export function useExecutiveDashboard() {
  const ctx = useContext(ExecutiveDashboardContext)
  if (!ctx) {
    throw new Error('useExecutiveDashboard must be used within ExecutiveDashboardProvider')
  }
  return ctx
}
