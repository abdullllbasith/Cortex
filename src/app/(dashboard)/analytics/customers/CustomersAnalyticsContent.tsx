'use client'

import { Suspense } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import { AnalyticsDateRangePicker, ExportMenu } from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import { useCustomerAnalytics } from '@/lib/api/hooks/useAnalytics'
import { useSearchParams } from 'next/navigation'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

function CustomersDashboard() {
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'month') as AnalyticsPeriod
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined

  const { data, error, isLoading } = useCustomerAnalytics({ period, startDate, endDate })

  const cohortMap = new Map<string, Record<number, number>>()
  for (const row of data?.cohorts ?? []) {
    if (!cohortMap.has(row.cohort)) cohortMap.set(row.cohort, {})
    cohortMap.get(row.cohort)![row.monthOffset] = row.retained
  }

  const churnRows = (data?.churnRisk ?? []).map((c: { customerId: string; name: string; predictedChurnDate: string; ltvAtRisk: number; churnScore: number }) => ({
    customer: c.name,
    churnDate: c.predictedChurnDate,
    ltvAtRisk: c.ltvAtRisk,
    score: Math.round(c.churnScore * 100),
  }))

  return (
    <PageContainer className="flex-1 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AnalyticsDateRangePicker />
        <div className="relative">
          <ExportMenu filename="customer-analytics" title="Customer Analytics" rows={churnRows} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load customer analytics.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <Stat label="Retention" value={`${data?.metrics?.retentionRate ?? 0}%`} />
            <Stat label="Churn Rate" value={`${data?.metrics?.churnRate ?? 0}%`} />
            <Stat label="Avg LTV" value={`$${Math.round(data?.metrics?.avgLifetimeValue ?? 0).toLocaleString()}`} />
            <Stat label="New Customers" value={String(data?.metrics?.newCustomers ?? 0)} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
        <h3 className="font-semibold mb-4">Cohort Retention</h3>
        {isLoading ? <Skeleton className="h-48" /> : cohortMap.size === 0 ? (
          <p className="text-sm text-slate-400">No cohort data yet — seed analytics events to populate.</p>
        ) : (
          <table className="text-xs w-full min-w-[500px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left pb-2 pr-4">Cohort</th>
                {Array.from({ length: 6 }, (_, i) => (
                  <th key={i} className="pb-2 px-2 text-center">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...cohortMap.entries()].map(([cohort, months]) => (
                <tr key={cohort}>
                  <td className="py-1 pr-4 font-medium">{cohort}</td>
                  {Array.from({ length: 6 }, (_, i) => {
                    const val = months[i] ?? 0
                    const intensity = val > 0 ? Math.min(val / 10, 1) : 0
                    return (
                      <td key={i} className="px-1 py-1">
                        <div
                          className="rounded text-center py-1"
                          style={{ backgroundColor: `rgba(99, 102, 241, ${intensity * 0.7})`, color: intensity > 0.4 ? '#fff' : '#64748b' }}
                        >
                          {val || '—'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h3 className="font-semibold mb-4">Churn Risk</h3>
          {isLoading ? <Skeleton className="h-64" /> : (
            <div className="space-y-2">
              {(data?.churnRisk ?? []).map((c: { customerId: string; name: string; predictedChurnDate: string; ltvAtRisk: number; churnScore: number }) => (
                <div key={c.customerId} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-slate-500">Predicted churn: {c.predictedChurnDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{Math.round(c.churnScore * 100)}% risk</p>
                    <p className="text-xs text-slate-500">${Math.round(c.ltvAtRisk).toLocaleString()} LTV at risk</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h3 className="font-semibold mb-4">Customer Segments</h3>
          {isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data?.segments ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {(data?.segments ?? []).map((s: { name: string; color: string }, i: number) => (
                    <Cell key={s.name} fill={s.color ?? ['#4f46e5', '#06b6d4', '#f59e0b'][i % 3]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}

export function CustomersAnalyticsContent() {
  return (
    <Suspense fallback={<Skeleton className="h-96 m-6 rounded-xl" />}>
      <CustomersDashboard />
    </Suspense>
  )
}
