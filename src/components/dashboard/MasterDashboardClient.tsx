'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Package,
  FileText,
  Bot,
  RefreshCw,
  Sparkles,
  Phone,
  ArrowRight,
} from 'lucide-react'
import { Button, Card, CardBody, Skeleton, toast } from '@/components/ui'
import { MetricCard } from './MetricCard'
import { LazyMasterDashboardCharts } from '@/lib/lazy/components'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import { useSessionStore } from '@/store/sessionStore'
import { useSessionReady } from '@/hooks/useSessionReady'
import { shouldReduceBackgroundWork } from '@/lib/performance/runtimeFlags'

interface DashboardKpiSparklines {
  revenueToday: number[]
  activeOrders: number[]
  pipelineValue: number[]
  lowStockItems: number[]
  arOutstanding: number[]
  aiCallsToday: number[]
}

interface DashboardData {
  kpis: {
    revenueToday: number
    activeOrders: number
    pipelineValue: number
    lowStockItems: number
    arOutstanding: number
    aiCallsToday: number
    aiCallsLimit: number
  }
  kpiSparklines?: DashboardKpiSparklines
  revenueChart14d: Array<{ date: string; revenue: number }>
  pipelineByStage: Array<{ stageId: string; name: string; count: number; value: number }>
  overdueInvoices: Array<{
    id: string
    invoiceNumber: string
    amountDue: number
    dueDate: string
    customerName: string
    canSendReminder: boolean
  }>
  reorderAlerts: Array<{
    productId: string
    name: string
    sku: string
    onHand: number
    reorderPoint: number
    urgency: string
  }>
  overdueFollowUps: Array<{
    contactId: string
    name: string
    nextFollowUpAt: string | null
    href: string
  }>
  recentTransactions: Array<{
    id: string
    customer: string
    productName?: string
    revenue: number
    timestamp: string
  }>
}

interface BriefingData {
  executiveSummary: string
  priorityActions: Array<{ label: string; href: string }>
  risks: string[]
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function MasterDashboardClient() {
  const router = useRouter()
  const sessionReady = useSessionReady()
  const tenantId = useSessionStore((s) => s.tenant?.id)
  const accessToken = useSessionStore((s) => s.accessToken)
  const devSessionSynced = useSessionStore((s) => s.devSessionSynced)
  const canFetchDashboard =
    sessionReady && devSessionSynced && (!accessToken || Boolean(tenantId))
  const dashboardKey = canFetchDashboard
    ? (['/analytics/dashboard', tenantId, accessToken] as const)
    : null
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    dashboardKey,
    ([path]) => swrFetcher<DashboardData>(path),
    {
      refreshInterval: shouldReduceBackgroundWork() ? 0 : 120_000,
      dedupingInterval: process.env.NODE_ENV === 'development' ? 5_000 : 60_000,
    },
  )

  const shouldLoadBriefing = canFetchDashboard && Boolean(data) && !isLoading
  const briefingKey = shouldLoadBriefing
    ? (['/analytics/briefing?quick=1', tenantId] as const)
    : null
  const {
    data: briefing,
    error: briefingError,
    isLoading: briefingLoading,
    isValidating: briefingValidating,
    mutate: refreshBriefing,
  } = useSWR<BriefingData>(briefingKey, swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  })

  const refreshDailyBriefing = useCallback(() => {
    void refreshBriefing()
  }, [refreshBriefing])

  async function sendInvoiceReminder(invoiceId: string) {
    try {
      await apiClient.post(`/finance/invoices/${invoiceId}/send`, {})
      toast.success('Reminder sent')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reminder')
    }
  }

  const spark = data?.kpiSparklines

  if (error && !data) {
    return (
      <PageContainer className="py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load dashboard. Try refreshing the page.
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="flex flex-col gap-5 py-5 lg:py-6">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={() => router.push('/assistant')}
        >
          AI briefing
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Revenue today"
          value={data?.kpis.revenueToday ?? 0}
          prefix="$"
          sparkline={spark?.revenueToday}
          loading={isLoading}
          animationDelay={0}
        />
        <MetricCard
          label="Active orders"
          value={data?.kpis.activeOrders ?? 0}
          sparkline={spark?.activeOrders}
          loading={isLoading}
          animationDelay={50}
        />
        <MetricCard
          label="Pipeline value"
          value={data?.kpis.pipelineValue ?? 0}
          prefix="$"
          sparkline={spark?.pipelineValue}
          loading={isLoading}
          animationDelay={100}
        />
        <MetricCard
          label="Low stock items"
          value={data?.kpis.lowStockItems ?? 0}
          urgent={(data?.kpis.lowStockItems ?? 0) > 0}
          positiveIsGood={false}
          sparkline={spark?.lowStockItems}
          loading={isLoading}
          animationDelay={150}
        />
        <MetricCard
          label="AR outstanding"
          value={data?.kpis.arOutstanding ?? 0}
          prefix="$"
          sparkline={spark?.arOutstanding}
          loading={isLoading}
          animationDelay={200}
        />
        <MetricCard
          label="AI calls today"
          numerator={data?.kpis.aiCallsToday}
          denominator={data?.kpis.aiCallsLimit}
          sparkline={spark?.aiCallsToday}
          loading={isLoading}
          animationDelay={250}
        />
      </div>

      {/* AI daily briefing — auto-loads after dashboard KPIs are ready */}
      <Card className="overflow-hidden border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-violet-50/80 to-white shadow-sm dark:border-indigo-800/60 dark:from-indigo-950/50 dark:via-violet-950/30 dark:to-slate-900">
        <CardBody className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold text-indigo-950 dark:text-indigo-100">AI daily briefing</h2>
                <p className="text-xs text-indigo-600/80 dark:text-indigo-300/80">SAIOS executive insight for today</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-indigo-700 hover:bg-indigo-100/80 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
              loading={briefingLoading || briefingValidating}
              onClick={refreshDailyBriefing}
              aria-label="Refresh AI briefing"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {briefingLoading && !briefing ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : briefing ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {briefing.executiveSummary}
              </p>
              {briefing.priorityActions.length > 0 && (
                <ul className="space-y-2">
                  {briefing.priorityActions.map((action, i) => (
                    <li key={i}>
                      <Link
                        href={action.href}
                        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200/80 text-xs text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-100">
                          {i + 1}
                        </span>
                        {action.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {briefing.risks.length > 0 && (
                <ul className="space-y-1 border-t border-indigo-200/60 pt-3 dark:border-indigo-800/50">
                  {briefing.risks.map((risk, i) => (
                    <li key={i} className="text-xs text-amber-800 dark:text-amber-200/90">
                      • {risk}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : briefingError ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load today&apos;s briefing.{' '}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={refreshDailyBriefing}
              >
                Try again
              </button>
            </p>
          ) : (
            <p className="text-sm text-indigo-700/70 dark:text-indigo-300/70">
              Preparing today&apos;s briefing…
            </p>
          )}
        </CardBody>
      </Card>

      {/* Row 4 — Charts (lazy-loaded Recharts bundle) */}
      <LazyMasterDashboardCharts
        isLoading={isLoading}
        revenueChart14d={data?.revenueChart14d ?? []}
        pipelineByStage={data?.pipelineByStage ?? []}
      />

      {/* Row 5 — Action columns */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-amber-600" />
              Overdue invoices
            </h3>
            {(data?.overdueInvoices.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No overdue invoices</p>
            ) : (
              <ul className="space-y-3">
                {data!.overdueInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <Link href={`/finance/invoices/${inv.id}`} className="font-medium hover:text-indigo-600">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-slate-500">{inv.customerName}</p>
                      <p className="text-xs text-slate-400">Due {inv.dueDate}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium tabular-nums">{formatCurrency(inv.amountDue)}</p>
                      {inv.canSendReminder && (
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline mt-1"
                          onClick={() => void sendInvoiceReminder(inv.id)}
                        >
                          Send reminder
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-red-600" />
              Reorder alerts
            </h3>
            {(data?.reorderAlerts.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">Stock levels healthy</p>
            ) : (
              <ul className="space-y-3">
                {data!.reorderAlerts.map((item) => (
                  <li key={item.productId} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.onHand} on hand · reorder {item.reorderPoint}
                      </p>
                    </div>
                    <Link
                      href={`/inventory/reorder?productId=${item.productId}`}
                      className="text-xs text-indigo-600 hover:underline shrink-0"
                    >
                      Create PO
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Phone className="h-4 w-4 text-blue-600" />
              Overdue follow-ups
            </h3>
            {(data?.overdueFollowUps.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No overdue follow-ups</p>
            ) : (
              <ul className="space-y-3">
                {data!.overdueFollowUps.map((c) => (
                  <li key={c.contactId} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <Link href={c.href} className="font-medium hover:text-indigo-600">
                        {c.name}
                      </Link>
                      {c.nextFollowUpAt && (
                        <p className="text-xs text-slate-400">
                          Due {new Date(c.nextFollowUpAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`${c.href}?logCall=1`}
                      className="text-xs text-indigo-600 hover:underline shrink-0"
                    >
                      Log call
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Row 6 — Recent transactions */}
      <Card>
        <CardBody className="p-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <ShoppingCart className="h-4 w-4" />
              Recent sales events
            </h3>
            <Link href="/analytics" className="text-xs text-indigo-600 hover:underline">
              View analytics
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 m-4" />
          ) : (data?.recentTransactions.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No sales events yet — deliver orders to record revenue.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-2 font-medium">Customer</th>
                    <th className="px-5 py-2 font-medium">Product</th>
                    <th className="px-5 py-2 font-medium">Revenue</th>
                    <th className="px-5 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="px-5 py-2">{tx.customer}</td>
                      <td className="px-5 py-2 text-slate-600">{tx.productName ?? '—'}</td>
                      <td className="px-5 py-2 tabular-nums font-medium">{formatCurrency(tx.revenue)}</td>
                      <td className="px-5 py-2 text-slate-500">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  )
}
