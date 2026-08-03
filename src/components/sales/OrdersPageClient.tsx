'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Download } from 'lucide-react'
import { PageHeader, Button, Badge, Input, Card, CardBody, Skeleton } from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

interface OrderListItem extends Record<string, unknown> {
  id: string
  orderNumber: string
  status: string
  paymentStatus: PaymentStatus
  total: number
  currency: string
  itemCount: number
  customerName: string | null
  fulfillmentLabel: 'Unfulfilled' | 'Partial' | 'Fulfilled'
  createdAt: string
}

interface OrderKpis {
  newOrders: number
  processing: number
  readyToShip: number
  deliveredThisMonth: number
  cancelled: number
}

const TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'READY_TO_SHIP', label: 'Ready to ship' },
  { id: 'DELIVERED_MONTH', label: 'Delivered (month)' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PICKING: 'warning',
  PACKED: 'warning',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

const PAYMENT_VARIANT: Record<PaymentStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  UNPAID: 'warning',
  PARTIAL: 'default',
  PAID: 'success',
}

const FULFILLMENT_VARIANT: Record<string, 'default' | 'success' | 'warning'> = {
  Unfulfilled: 'warning',
  Partial: 'default',
  Fulfilled: 'success',
}

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function exportCsv(rows: OrderListItem[]) {
  const header = ['Order #', 'Customer', 'Items', 'Total', 'Payment', 'Fulfillment', 'Status', 'Date']
  const lines = rows.map((r) =>
    [
      r.orderNumber,
      r.customerName ?? '',
      r.itemCount,
      r.total,
      r.paymentStatus,
      r.fulfillmentLabel,
      r.status,
      new Date(r.createdAt).toISOString(),
    ].join(','),
  )
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function OrdersPageClient() {
  const router = useRouter()
  const [tab, setTab] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const { data: kpis, isLoading: kpisLoading } = useSWR<OrderKpis>('/sales/orders?stats=true', swrFetcher)

  const queryKey = useMemo(() => {
    const p = new URLSearchParams()
    if (tab !== 'ALL') p.set('status', tab)
    if (search) p.set('search', search)
    const qs = p.toString()
    return `/sales/orders${qs ? `?${qs}` : ''}`
  }, [tab, search])

  const { data, isLoading } = useSWR<{ items: OrderListItem[] }>(queryKey, swrFetcher)
  const items = data?.items ?? []

  const columns: ColumnDef<OrderListItem>[] = useMemo(
    () => [
      {
        id: 'number',
        header: 'Order #',
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-indigo-600 hover:underline"
            onClick={() => router.push(`/sales/orders/${row.id}`)}
          >
            {row.orderNumber}
          </button>
        ),
      },
      { id: 'customer', header: 'Customer', cell: ({ row }) => row.customerName ?? '—' },
      { id: 'items', header: 'Items', cell: ({ row }) => row.itemCount },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => formatMoney(row.total, row.currency),
      },
      {
        id: 'payment',
        header: 'Payment',
        cell: ({ row }) => (
          <Badge variant={PAYMENT_VARIANT[row.paymentStatus]}>{row.paymentStatus}</Badge>
        ),
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        cell: ({ row }) => (
          <Badge variant={FULFILLMENT_VARIANT[row.fulfillmentLabel] ?? 'default'}>
            {row.fulfillmentLabel}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.status] ?? 'default'}>{row.status}</Badge>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => new Date(row.createdAt).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Link href={`/sales/orders/${row.id}`}>
            <Button size="sm" variant="secondary">
              View
            </Button>
          </Link>
        ),
      },
    ],
    [router],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sales Orders"
        subtitle="Quote to order — confirm, fulfill, deliver, and invoice"
        breadcrumbs={[
          { label: 'Sales', href: '/sales/quotes' },
          { label: 'Orders' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => exportCsv(items)} disabled={!items.length}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
            <Link href="/sales/orders/new">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                New Order
              </Button>
            </Link>
          </div>
        }
      />

      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        {kpisLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : kpis ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'New Orders', value: kpis.newOrders, tab: 'NEW' },
              { label: 'Processing', value: kpis.processing, tab: 'PROCESSING' },
              { label: 'Ready to Ship', value: kpis.readyToShip, tab: 'READY_TO_SHIP' },
              { label: 'Delivered This Month', value: kpis.deliveredThisMonth, tab: 'DELIVERED_MONTH' },
              { label: 'Cancelled', value: kpis.cancelled, tab: 'CANCELLED' },
            ].map((k) => (
              <button
                key={k.tab}
                type="button"
                onClick={() => setTab(k.tab)}
                className="text-left"
              >
                <Card className={tab === k.tab ? 'ring-2 ring-indigo-500' : ''}>
                  <CardBody className="p-3">
                    <p className="text-xs text-slate-500">{k.label}</p>
                    <p className="text-2xl font-semibold tabular-nums">{k.value}</p>
                  </CardBody>
                </Card>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 p-6">
        <Input
          placeholder="Search orders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <DataTable
          columns={columns}
          data={items}
          loading={isLoading}
          keyField="id"
          onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
        />
      </div>
    </div>
  )
}
