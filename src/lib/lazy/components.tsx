'use client'

import dynamic from 'next/dynamic'
import { LazyFallback, PageFallback } from './fallbacks'

export { LazyFallback, PageFallback } from './fallbacks'

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

/** Master dashboard chart row (Recharts). */
export const LazyMasterDashboardCharts = dynamic(
  () => import('@/components/dashboard/MasterDashboardCharts').then((m) => m.MasterDashboardCharts),
  { loading: () => <LazyFallback minHeight={260} />, ssr: false },
)

/** Generic chart panel placeholder for analytics sections. */
export const LazyChartPanel = dynamic(
  () => import('@/components/analytics/RevenueChart').then((m) => m.RevenueChart),
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

/** ⌘K command palette — loaded on first open. */
export const LazyCommandPalette = dynamic(
  () => import('@/components/layout/CommandPalette').then((m) => m.CommandPalette),
  { loading: () => null, ssr: false },
)

/** Metric card sparkline (Recharts micro chart). */
export const LazyMetricSparkline = dynamic(
  () => import('@/components/dashboard/MetricSparkline').then((m) => m.MetricSparkline),
  { loading: () => <LazyFallback minHeight={32} />, ssr: false },
)

/* ── Route-level page clients (code-split per section) ─────────────────── */

export const LazyMasterDashboardClient = dynamic(
  () => import('@/components/dashboard/MasterDashboardClient').then((m) => m.MasterDashboardClient),
  { loading: () => <PageFallback minHeight={560} />, ssr: false },
)

export const LazyFinanceDashboardClient = dynamic(
  () => import('@/components/finance/FinanceDashboardClient').then((m) => m.FinanceDashboardClient),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyInventoryDashboardClient = dynamic(
  () => import('@/components/inventory/InventoryDashboardClient').then((m) => m.InventoryDashboardClient),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyHrDashboardClient = dynamic(
  () => import('@/components/hr/HrDashboardClient').then((m) => m.HrDashboardClient),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyCrmDashboardClient = dynamic(
  () => import('@/components/crm/CrmDashboardClient').then((m) => m.CrmDashboardClient),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyCrmAnalyticsClient = dynamic(
  () => import('@/components/crm/CrmAnalyticsClient').then((m) => m.CrmAnalyticsClient),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyPipelineKanbanClient = dynamic(
  () => import('@/components/crm/PipelineKanbanClient').then((m) => m.PipelineKanbanClient),
  { loading: () => <PageFallback minHeight={640} />, ssr: false },
)

export const LazyAnalyticsPageContent = dynamic(
  () => import('@/app/(dashboard)/analytics/AnalyticsPageContent').then((m) => m.AnalyticsPageContent),
  { loading: () => <PageFallback minHeight={720} />, ssr: false },
)

export const LazyChatInterface = dynamic(
  () => import('@/components/assistant/ChatInterface').then((m) => m.ChatInterface),
  { loading: () => <PageFallback minHeight={600} />, ssr: false },
)

export const LazyPredictionsPageClient = dynamic(
  () => import('@/app/(dashboard)/predictions/PredictionsPageClient'),
  { loading: () => <PageFallback />, ssr: false },
)

export const LazyWorkflowsPageClient = dynamic(
  () => import('@/app/(dashboard)/workflows/WorkflowsPageClient'),
  { loading: () => <PageFallback />, ssr: false },
)
