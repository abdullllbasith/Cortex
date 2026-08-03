'use client'

import { Spinner } from '@/components/ui'

export function LazyFallback({ minHeight = 120 }: { minHeight?: number }) {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ minHeight }}
      aria-busy="true"
      aria-label="Loading"
    >
      <Spinner size="md" />
    </div>
  )
}

export function PageFallback({ minHeight = 480 }: { minHeight?: number }) {
  return (
    <div
      className="flex w-full flex-col gap-4 p-6"
      style={{ minHeight }}
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/80" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/80" />
    </div>
  )
}
