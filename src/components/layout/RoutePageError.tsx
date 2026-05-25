'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'

export default function RoutePageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Something went wrong</h2>
      <p className="max-w-md text-sm text-slate-500">{error.message || 'An unexpected error occurred.'}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
