'use client'

import { Suspense } from 'react'
import { Sparkles } from 'lucide-react'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import {
  KPIScorecard,
  RevenueChart,
  CustomerFunnelChart,
  InventoryHealthGrid,
  SupplierRadarChart,
  AnalyticsDateRangePicker,
  ExportMenu,
} from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import { useExecutiveAnalytics } from '@/lib/api/hooks/useAnalytics'
import { useSearchParams } from 'next/navigation'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

function AnalyticsDashboard() {
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'month') as AnalyticsPeriod
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined

  const { data, error, isLoading } = useExecutiveAnalytics({ period, startDate, endDate })

  const scorecard = data?.scorecard ?? []
  const findScore = (metric: string) => scorecard.find((s) => s.metric === metric)

  const kpis = data
    ? [
        {
          id: 'revenue',
          label: 'Revenue',
          value: findScore('Revenue')?.value ?? 0,
          change: findScore('Revenue')?.change ?? 0,
          prefix: '$',
          sparkline: data.revenueChart?.map((r) => r.revenue),
          rag: findScore('Revenue')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'orders',
          label: 'Orders',
          value: findScore('Orders')?.value ?? 0,
          change: findScore('Orders')?.change ?? 0,
          sparkline: data.revenueChart?.map((r) => r.revenue / 100),
          rag: findScore('Orders')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'customers',
          label: 'Customers',
          value: (data.modules?.customers.newCustomers ?? 0) + (data.modules?.customers.returningCustomers ?? 0),
          change: data.modules?.customers.retentionRate ?? 0,
          rag: findScore('Customers')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
        {
          id: 'gross-margin',
          label: 'Gross Margin',
          value: findScore('Gross Margin')?.value ?? 0,
          change: 0,
          suffix: '%',
          sparkline: data.revenueChart?.map((r) => r.marginPct),
          rag: findScore('Gross Margin')?.rag as 'green' | 'amber' | 'red' | undefined,
        },
      ]
    : []

  const txRows = (data?.transactions ?? []).map((t) => ({
    id: String(t.id ?? ''),
    product: String(t.productName ?? t.productId ?? ''),
    revenue: Number(t.revenue ?? 0),
    date: String(t.timestamp ?? '').slice(0, 10),
  }))

  return (
    <ResponsiveContainer className="flex-1 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AnalyticsDateRangePicker />
        <div className="relative">
          <ExportMenu filename="executive-analytics" title="Executive Analytics" rows={txRows} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Failed to load analytics. Ensure the database is seeded and migrations are applied.
        </div>
      )}

      <KPIScorecard metrics={kpis} loading={isLoading} />

      {data?.insight?.summary && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30 p-4 flex gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">AI Insight</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{data.insight.summary}</p>
          </div>
        </div>
      )}

      <RevenueChart data={data?.revenueChart ?? []} loading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerFunnelChart data={data?.funnel ?? { visitors: 0, leads: 0, customers: 0, repeat: 0 }} loading={isLoading} />
        <InventoryHealthGrid
          fastMovers={data?.modules?.inventory?.fastMovers ?? []}
          deadStock={data?.modules?.inventory?.deadStock ?? []}
          reorderRequired={data?.modules?.inventory?.reorderRequired ?? []}
          loading={isLoading}
        />
      </div>

      <SupplierRadarChart data={data?.supplierRadar ?? []} loading={isLoading} />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 m-4" />
        ) : txRows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No transactions in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Revenue</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {txRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono text-xs">{row.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{row.product}</td>
                    <td className="px-4 py-2">${row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-500">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ResponsiveContainer>
  )
}

export function AnalyticsPageContent() {
  return (
    <Suspense fallback={<Skeleton className="h-96 m-6 rounded-xl" />}>
      <AnalyticsDashboard />
    </Suspense>
  )
}
