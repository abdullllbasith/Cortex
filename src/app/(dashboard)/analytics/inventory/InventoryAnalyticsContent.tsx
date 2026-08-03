'use client'

import { ResponsiveContainer as PageContainer } from '@/components/layout/ResponsiveContainer'
import { InventoryHealthGrid } from '@/components/analytics'
import { Skeleton } from '@/components/ui'
import { useInventoryAnalytics } from '@/lib/api/hooks/useAnalytics'

export function InventoryAnalyticsContent() {
  const { data, error, isLoading } = useInventoryAnalytics()

  return (
    <PageContainer className="flex-1 py-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load inventory analytics.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <Stat label="Stock Turnover" value={`${data?.metrics?.stockTurnoverRate ?? 0}x`} />
            <Stat label="Fast Movers" value={String(data?.metrics?.fastMovers?.length ?? 0)} />
            <Stat label="Reorder Required" value={String(data?.metrics?.reorderRequired?.length ?? 0)} />
          </>
        )}
      </div>

      <InventoryHealthGrid
        fastMovers={data?.metrics?.fastMovers ?? []}
        deadStock={data?.metrics?.deadStock ?? []}
        reorderRequired={data?.metrics?.reorderRequired ?? []}
        loading={isLoading}
      />
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
