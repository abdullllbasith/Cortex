'use client'

import { Suspense } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import { SupplierRadarChart, AnalyticsDateRangePicker } from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import { useSupplierAnalytics } from '@/lib/api/hooks/useAnalytics'
import { useSearchParams } from 'next/navigation'
import type { AnalyticsPeriod } from '@/lib/analytics/periodUtils'

function SuppliersDashboard() {
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'month') as AnalyticsPeriod
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined

  const { data, error, isLoading } = useSupplierAnalytics({ period, startDate, endDate })

  const radarData = (data?.leaderboard ?? []).slice(0, 5).map((s: { name: string; score: number; onTimeRate: number }) => ({
    supplier: s.name,
    reliability: s.score,
    speed: s.onTimeRate,
    cost: 100 - s.score * 0.2,
    quality: s.score * 0.95,
    communication: s.score * 0.9,
  }))

  return (
    <PageContainer className="flex-1 py-6 space-y-6">
      <AnalyticsDateRangePicker />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load supplier analytics.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <Stat label="On-Time Delivery" value={`${data?.metrics?.onTimeDeliveryRate ?? 0}%`} />
            <Stat label="Avg Delivery Days" value={String(data?.metrics?.avgDeliveryDays ?? 0)} />
            <Stat label="Cost Variance" value={`${data?.metrics?.costVariance ?? 0}%`} />
            <Stat label="Suppliers Tracked" value={String(data?.leaderboard?.length ?? 0)} />
          </>
        )}
      </div>

      <SupplierRadarChart data={radarData} loading={isLoading} />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-semibold mb-4">Cost Trend</h3>
        {isLoading ? <Skeleton className="h-64" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.costTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
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

export function SuppliersAnalyticsContent() {
  return (
    <Suspense fallback={<Skeleton className="h-96 m-6 rounded-xl" />}>
      <SuppliersDashboard />
    </Suspense>
  )
}
