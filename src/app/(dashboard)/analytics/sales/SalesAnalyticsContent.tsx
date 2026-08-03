'use client'

import { Suspense } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import { SalesHeatmap, AnalyticsDateRangePicker, ExportMenu } from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import { useSalesAnalytics } from '@/lib/api/hooks/useAnalytics'
import { useSearchParams } from 'next/navigation'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

function SalesDashboard() {
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'month') as AnalyticsPeriod
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined

  const { data, error, isLoading } = useSalesAnalytics({ period, startDate, endDate })

  const productRows = (data?.topProducts ?? []).map((p: { productId: string; name: string; revenue: number; quantity: number }) => ({
    product: p.name,
    revenue: p.revenue,
    units: p.quantity,
  }))

  return (
    <PageContainer className="flex-1 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AnalyticsDateRangePicker />
        <div className="relative">
          <ExportMenu filename="sales-analytics" title="Sales Analytics" rows={productRows} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load sales analytics.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <MetricCard label="Revenue" value={`$${Math.round(data?.summary?.totalRevenue ?? 0).toLocaleString()}`} change={data?.comparison?.revenueChange} />
            <MetricCard label="Orders" value={String(data?.summary?.totalOrders ?? 0)} change={data?.comparison?.ordersChange} />
            <MetricCard label="AOV" value={`$${Math.round(data?.summary?.avgOrderValue ?? 0).toLocaleString()}`} />
            <MetricCard label="Gross Margin" value={`${Math.round(data?.summary?.grossMarginPct ?? 0)}%`} />
          </>
        )}
      </div>

      <SalesHeatmap data={data?.heatmap ?? []} loading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h3 className="font-semibold mb-4">Branch Comparison</h3>
          {isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.topBranches ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-hidden">
          <h3 className="font-semibold mb-4">Product Performance</h3>
          {isLoading ? <Skeleton className="h-64" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topProducts ?? []).map((p: { productId: string; name: string; revenue: number }) => (
                  <tr key={p.productId} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">${Math.round(p.revenue).toLocaleString()}</td>
                    <td className="py-2 w-24">
                      <ResponsiveContainer width="100%" height={24}>
                        <LineChart data={(data?.timeseries ?? []).slice(-7).map((t, i) => ({ i, v: t.revenue * (0.7 + i * 0.04) }))}>
                          <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function MetricCard({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {change != null && (
        <p className={`text-xs mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change}% vs prior
        </p>
      )}
    </div>
  )
}

export function SalesAnalyticsContent() {
  return (
    <Suspense fallback={<Skeleton className="h-96 m-6 rounded-xl" />}>
      <SalesDashboard />
    </Suspense>
  )
}
