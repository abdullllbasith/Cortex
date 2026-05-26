'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  RefreshCw,
  ShoppingCart,
  Star,
  X,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

type UrgencyFilter = 'critical' | 'warning' | 'all'

interface ReorderSuggestion {
  productId: string
  sku: string
  productName: string
  quantityOnHand: number
  reorderPoint: number
  suggestedQty: number
  unitCost: number
  lineTotal: number
  urgency: 'critical' | 'warning'
  suggestedOrderDate: string
}

interface ReorderSupplierGroup {
  supplierId: string
  supplierName: string
  reliabilityScore: number
  paymentTerms: string
  suggestions: ReorderSuggestion[]
  totalCost: number
}

interface ReorderResponse {
  lastCheckedAt: string
  groups: ReorderSupplierGroup[]
  totalSuggestions: number
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatCheckedAt(iso: string | null | undefined) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

function ReliabilityBadge({ score }: { score: number }) {
  const stars = Math.round((score / 100) * 5 * 10) / 10
  const variant = stars >= 4 ? 'success' : stars >= 2.5 ? 'warning' : 'danger'
  return (
    <Badge variant={variant} className="inline-flex items-center gap-1">
      <Star className="h-3 w-3 fill-current" />
      {stars.toFixed(1)} reliability
    </Badge>
  )
}

export function ReorderPageClient() {
  const router = useRouter()
  const [urgency, setUrgency] = useState<UrgencyFilter>('all')
  const [busySupplier, setBusySupplier] = useState<string | null>(null)
  const [creatingAll, setCreatingAll] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const queryKey = useMemo(
    () => `/inventory/reorder?urgency=${urgency}`,
    [urgency],
  )

  const { data, mutate, isLoading } = useSWR<ReorderResponse>(queryKey, swrFetcher)

  const groups = data?.groups ?? []
  const totalSuggestions = data?.totalSuggestions ?? 0

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/inventory/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', urgency }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Refresh failed')
      toast.success('Reorder suggestions updated')
      mutate(json.data, false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }, [mutate, urgency])

  const handleCreatePO = useCallback(
    async (supplierId: string) => {
      if (supplierId === '__unassigned__') {
        toast.error('Assign a supplier before creating a PO')
        return
      }
      setBusySupplier(supplierId)
      try {
        const res = await fetch('/api/inventory/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_po', supplierId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create PO')
        toast.success(`Draft PO ${json.data.poNumber} created`)
        mutate()
        router.push(`/inventory/purchase-orders/${json.data.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create PO')
      } finally {
        setBusySupplier(null)
      }
    },
    [mutate, router],
  )

  const handleCreateAll = useCallback(async () => {
    setCreatingAll(true)
    try {
      const res = await fetch('/api/inventory/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_all', urgency }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create POs')
      const count = json.data.purchaseOrders?.length ?? 0
      toast.success(`Created ${count} draft purchase order(s)`)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create POs')
    } finally {
      setCreatingAll(false)
    }
  }, [mutate, urgency])

  const handleDismissGroup = useCallback(
    async (productIds: string[]) => {
      try {
        const res = await fetch('/api/inventory/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss_group', productIds, days: 7 }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? 'Failed to dismiss')
        toast.success('Suggestions snoozed for 7 days')
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to dismiss')
      }
    },
    [mutate],
  )

  const suggestionColumns: ColumnDef<Record<string, unknown>>[] = [
    {
      id: 'productName',
      header: 'Product',
      cell: ({ row }) => {
        const r = row as unknown as ReorderSuggestion
        return (
          <div>
            <p className="font-medium text-sm">{r.productName}</p>
            <p className="text-xs text-slate-500">{r.sku}</p>
          </div>
        )
      },
    },
    {
      id: 'quantityOnHand',
      header: 'Current Stock',
      cell: ({ row }) => {
        const r = row as unknown as ReorderSuggestion
        return (
          <span className={r.quantityOnHand <= 0 ? 'text-red-600 font-semibold' : ''}>
            {r.quantityOnHand}
          </span>
        )
      },
    },
    { id: 'suggestedQty', header: 'Reorder Qty', accessorKey: 'suggestedQty', type: 'number' },
    {
      id: 'unitCost',
      header: 'Unit Cost',
      cell: ({ row }) => formatMoney((row as unknown as ReorderSuggestion).unitCost),
    },
    {
      id: 'lineTotal',
      header: 'Line Total',
      cell: ({ row }) => formatMoney((row as unknown as ReorderSuggestion).lineTotal),
    },
    {
      id: 'urgency',
      header: 'Urgency',
      cell: ({ row }) => {
        const r = row as unknown as ReorderSuggestion
        return (
          <Badge variant={r.urgency === 'critical' ? 'danger' : 'warning'}>
            {r.urgency === 'critical' ? 'Critical' : 'Warning'}
          </Badge>
        )
      },
    },
  ]

  const creatableGroups = groups.filter((g) => g.supplierId && g.supplierId !== '__unassigned__')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Reorder Centre"
        subtitle={`Last checked: ${formatCheckedAt(data?.lastCheckedAt)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/inventory' },
          { label: 'Reorder Centre' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
              {(['all', 'critical', 'warning'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`px-3 py-1.5 capitalize ${
                    urgency === u
                      ? u === 'critical'
                        ? 'bg-red-600 text-white'
                        : u === 'warning'
                          ? 'bg-amber-500 text-white'
                          : 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {u === 'critical' ? 'Critical' : u === 'warning' ? 'Warning' : 'All'}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={!creatableGroups.length || creatingAll}
              onClick={() => void handleCreateAll()}
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Create All POs
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {!isLoading && totalSuggestions === 0 && (
          <Card>
            <CardBody className="p-10 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                All stock levels are healthy
              </p>
              <p className="text-sm text-slate-500 mt-2">
                No products are at or below their reorder points.
              </p>
              <Link href="/inventory" className="text-sm text-indigo-600 hover:underline mt-4 inline-block">
                Back to inventory dashboard
              </Link>
            </CardBody>
          </Card>
        )}

        {groups.map((group) => (
          <Card key={group.supplierId}>
            <CardBody className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-lg">{group.supplierName}</h3>
                    <ReliabilityBadge score={group.reliabilityScore} />
                    <Badge variant="default">{group.paymentTerms.replace('NET', 'Net ')}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {group.suggestions.length} product(s)
                  </p>
                </div>
              </div>

              {group.supplierId === '__unassigned__' && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Assign preferred suppliers to these products before creating a PO.
                </div>
              )}

              <DataTable
                columns={suggestionColumns}
                data={group.suggestions as unknown as Record<string, unknown>[]}
                loading={isLoading}
                keyField="productId"
                emptyTitle="No suggestions in this group"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-sm font-semibold">
                  Supplier total: {formatMoney(group.totalCost)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void handleDismissGroup(group.suggestions.map((s) => s.productId))
                    }
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Dismiss 7 days
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busySupplier === group.supplierId || group.supplierId === '__unassigned__'}
                    onClick={() => void handleCreatePO(group.supplierId)}
                  >
                    Create Draft PO
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
