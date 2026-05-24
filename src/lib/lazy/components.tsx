'use client'

import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui'

function LazyFallback({ minHeight = 120 }: { minHeight?: number }) {
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

/** Heavy data table — deferred on client. */
export const LazyDataTable = dynamic(
  () => import('@/components/data/DataTable').then((m) => m.DataTable),
  { loading: () => <LazyFallback minHeight={200} /> },
) as typeof import('@/components/data/DataTable').DataTable

/** Recharts dashboard chart. */
export const LazyRevenueChart = dynamic(
  () => import('@/components/dashboard/RevenueChart').then((m) => m.RevenueChart),
  { loading: () => <LazyFallback minHeight={280} />, ssr: false },
)

/** React Flow workflow builder canvas. */
export const LazyWorkflowBuilder = dynamic(
  () => import('@/components/workflows/WorkflowBuilder').then((m) => m.WorkflowBuilder),
  { loading: () => <LazyFallback minHeight={480} />, ssr: false },
)

/** Tiptap rich-text editor field. */
export const LazyFormRichText = dynamic(
  () => import('@/components/forms/FormRichText').then((m) => m.FormRichText),
  { loading: () => <LazyFallback minHeight={160} />, ssr: false },
)

/** Generic Recharts chart bundle for analytics pages. */
export const LazyChartPanel = dynamic(
  () => import('@/components/dashboard/RevenueChart').then((m) => m.RevenueChart),
  { loading: () => <LazyFallback minHeight={320} />, ssr: false },
)
