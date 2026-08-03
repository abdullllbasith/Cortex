'use client'

import { cn } from '@/lib/utils'

type EmbeddingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'INDEXED'
  | 'COMPLETED'
  | 'ERROR'
  | 'FAILED'

const config: Record<EmbeddingStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
  },
  INDEXED: {
    label: 'Indexed',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  COMPLETED: {
    label: 'Indexed',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  ERROR: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  },
  FAILED: {
    label: 'Error',
    className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  },
}

export function EmbeddingStatusBadge({ status }: { status?: string }) {
  const key = (status ?? 'PENDING') as EmbeddingStatus
  const { label, className } = config[key] ?? config.PENDING

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', className)}>
      {label}
    </span>
  )
}
