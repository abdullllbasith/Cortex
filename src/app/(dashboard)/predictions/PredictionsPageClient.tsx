'use client'

import { useState } from 'react'
import { ChevronDown, RefreshCw, X } from 'lucide-react'
import { PageHeader, Button, Badge, Skeleton } from '@/components/ui'
import {
  SalesForecastChart,
  InventoryRiskTable,
  ChurnRiskList,
  SupplierRiskMatrix,
} from '@/components/predictions'
import {
  useSalesPredictions,
  useInventoryPredictions,
  useCustomerChurnPredictions,
  useSupplierRiskPredictions,
  useRefreshPredictions,
} from '@/lib/api/hooks/usePredictions'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api/apiClient'
import { queryKeys } from '@/lib/api/queryKeys'
import { useMutateAlerts } from '@/lib/api/hooks/useAlerts'
import { cn } from '@/lib/utils'

interface AlertBanner {
  id: string
  title: string
  severity: 'danger' | 'warning' | 'info'
  rawSeverity?: string
  read: boolean
}

function CollapsiblePanel({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  )
}

export default function PredictionsPageClient() {
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30)
  const [refreshing, setRefreshing] = useState(false)
  const { refresh } = useRefreshPredictions()
  const { markRead } = useMutateAlerts()

  const { data: alerts = [] } = useSWR<AlertBanner[]>(
    queryKeys.alerts.list(true),
    () => swrFetcher('/alerts?unreadOnly=true&limit=10'),
  )

  const { data: sales, isLoading: salesLoading } = useSalesPredictions(horizon, 'daily')
  const { data: inventory, isLoading: invLoading } = useInventoryPredictions('all')
  const { data: customers, isLoading: churnLoading } = useCustomerChurnPredictions('all', 1)
  const { data: suppliers, isLoading: supLoading } = useSupplierRiskPredictions()

  const criticalAlerts = alerts.filter(
    (a) => !a.read && (a.rawSeverity === 'CRITICAL' || a.rawSeverity === 'HIGH' || a.severity === 'danger'),
  )

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refresh()
      window.location.reload()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Predictions"
        subtitle="AI-powered forecasts for sales, inventory, churn, and supplier risk"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Predictions' }]}
        actions={
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} />
            Refresh predictions
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {criticalAlerts.length > 0 && (
          <div className="space-y-2">
            {criticalAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">{alert.title}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => markRead.trigger(alert.id)}>Dismiss</Button>
                  <button type="button" onClick={() => markRead.trigger(alert.id)} aria-label="Dismiss">
                    <X className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <CollapsiblePanel title="Sales Forecast" defaultOpen>
          {salesLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <SalesForecastChart
              historical={sales?.historical ?? []}
              forecast={sales?.forecast ?? []}
              trendPct={sales?.trendPct}
              trendDirection={sales?.trendDirection}
              horizon={horizon}
              onHorizonChange={setHorizon}
            />
          )}
        </CollapsiblePanel>

        <CollapsiblePanel title="Inventory Risk">
          <InventoryRiskTable items={inventory?.items ?? []} loading={invLoading} />
        </CollapsiblePanel>

        <CollapsiblePanel title="Customer Churn">
          <div className="mb-3 flex gap-2">
            {(['all', 'high', 'medium', 'low'] as const).map((r) => (
              <Badge key={r} variant="default" size="sm">{r}</Badge>
            ))}
          </div>
          <ChurnRiskList items={customers?.items ?? []} loading={churnLoading} />
        </CollapsiblePanel>

        <CollapsiblePanel title="Supplier Risk">
          <SupplierRiskMatrix items={suppliers?.items ?? []} loading={supLoading} />
        </CollapsiblePanel>
      </div>
    </div>
  )
}
