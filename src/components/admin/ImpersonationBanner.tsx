'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import useSWR from 'swr'

interface ImpersonationStatus {
  active: boolean
  session?: {
    tenantId: string
    tenantName: string
    adminId: string
    adminEmail: string
    expiresAt: string
  }
}

export function ImpersonationBanner() {
  const { data, mutate } = useSWR<ImpersonationStatus>(
    '/admin/impersonation/status',
    swrFetcher,
    { refreshInterval: 60_000 },
  )
  const [ending, setEnding] = useState(false)

  const endSession = useCallback(async () => {
    setEnding(true)
    try {
      await fetch('/api/admin/impersonation/status', {
        method: 'POST',
        credentials: 'include',
      })
      mutate({ active: false }, false)
      window.location.href = '/admin/dashboard'
    } finally {
      setEnding(false)
    }
  }, [mutate])

  if (!data?.active || !data.session) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] flex items-center justify-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Impersonating <strong>{data.session.tenantName}</strong>
        <span className="hidden sm:inline text-amber-800 dark:text-amber-300">
          {' '}
          — all actions are audited
        </span>
      </span>
      <Button
        size="sm"
        variant="secondary"
        loading={ending}
        onClick={() => void endSession()}
        className="ml-2 shrink-0 border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900 dark:hover:bg-amber-800"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Admin
      </Button>
    </div>
  )
}
