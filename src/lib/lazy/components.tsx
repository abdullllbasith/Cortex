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

/** Workflow analytics charts (Recharts). */
export const LazyWorkflowAnalytics = dynamic(
  () => import('@/components/workflows/WorkflowAnalytics').then((m) => m.WorkflowAnalytics),
  { loading: () => <LazyFallback minHeight={320} />, ssr: false },
)

/** Predictions forecast chart. */
export const LazySalesForecastChart = dynamic(
  () => import('@/components/predictions/SalesForecastChart').then((m) => m.SalesForecastChart),
  { loading: () => <LazyFallback minHeight={320} />, ssr: false },
)

/** Supplier risk matrix chart. */
export const LazySupplierRiskMatrix = dynamic(
  () => import('@/components/predictions/SupplierRiskMatrix').then((m) => m.SupplierRiskMatrix),
  { loading: () => <LazyFallback minHeight={320} />, ssr: false },
)

/** Analytics KPI scorecard with sparklines. */
export const LazyKPIScorecard = dynamic(
  () => import('@/components/analytics/KPIScorecard').then((m) => m.KPIScorecard),
  { loading: () => <LazyFallback minHeight={200} />, ssr: false },
)

/** Tiptap rich-text editor field. */
export const LazyFormRichText = dynamic(
  () => import('@/components/forms/FormRichText').then((m) => m.FormRichText),
  { loading: () => <LazyFallback minHeight={160} />, ssr: false },
)
