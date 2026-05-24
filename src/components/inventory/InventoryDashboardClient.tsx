'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  Truck,
  ArrowRight,
} from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Skeleton } from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'

interface DashboardData {
  kpis: {
    totalSkus: number
    totalInventoryValue: number
    lowStockItems: number
    outOfStock: number
    itemsOnOrder: number
  }
  stockHealth: Array<{ name: string; value: number; key: string }>
  fastMoving: Array<{
    productId: string
    sku: string
    name: string
    unitsSold: number
    revenue: number
    velocity: number
  }>
  deadStock: Array<{
    productId: string
    sku: string
    name: string
    quantityOnHand: number
    valueTiedUp: number
    daysIdle: number
  }>
  reorderRecommendations: Array<{
    productId: string
    sku: string
    name: string
    onHand: number
    reorderPoint: number
    suggestedOrderQty: number
  }>
}

const HEALTH_COLORS = ['#10b981', '#f59e0b', '#ef4444']

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  onClick,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  href?: string
  onClick?: () => void
}) {
  const inner = (
    <Card className={href || onClick ? 'cursor-pointer hover:border-indigo-300 transition-colors' : ''}>
      <CardBody className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
  if (href) return <Link href={href}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="text-left w-full">{inner}</button>
  return inner
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function InventoryDashboardClient() {
  const router = useRouter()
  const { data, isLoading } = useSWR<DashboardData>('/inventory/dashboard', swrFetcher)

  const fastCols: ColumnDef<Record<string, unknown>>[] = [
    { id: 'sku', header: 'SKU', accessorKey: 'sku' },
    { id: 'name', header: 'Product', accessorKey: 'name' },
    { id: 'unitsSold', header: 'Sold (30d)', accessorKey: 'unitsSold', type: 'number' },
    {
      id: 'velocity',
      header: 'Velocity/day',
      cell: ({ row }) => (row as { velocity: number }).velocity.toFixed(2),
    },
    {
      id: 'revenue',
      header: 'Revenue',
      cell: ({ row }) => formatMoney((row as { revenue: number }).revenue),
    },
  ]

  const deadCols: ColumnDef<Record<string, unknown>>[] = [
    { id: 'sku', header: 'SKU', accessorKey: 'sku' },
    { id: 'name', header: 'Product', accessorKey: 'name' },
    { id: 'quantityOnHand', header: 'Qty', accessorKey: 'quantityOnHand', type: 'number' },
    {
      id: 'valueTiedUp',
      header: 'Value Tied Up',
      cell: ({ row }) => formatMoney((row as { valueTiedUp: number }).valueTiedUp),
    },
    { id: 'daysIdle', header: 'Days Idle', accessorKey: 'daysIdle', type: 'number' },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Inventory"
        subtitle="Stock health, velocity, and reorder intelligence"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory' },
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link href="/inventory/products" className="text-sm text-indigo-600 hover:underline">
              Products
            </Link>
            <Link href="/inventory/purchase-orders" className="text-sm text-indigo-600 hover:underline">
              Purchase Orders
            </Link>
            <Link href="/inventory/adjustments" className="text-sm text-indigo-600 hover:underline">
              Adjustments
            </Link>
            <Link href="/inventory/warehouses" className="text-sm text-indigo-600 hover:underline">
              Warehouses
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="Total SKUs" value={data?.kpis.totalSkus ?? 0} icon={Package} href="/inventory/products" />
            <KpiCard label="Inventory Value" value={formatMoney(data?.kpis.totalInventoryValue ?? 0)} icon={DollarSign} />
            <KpiCard
              label="Low Stock"
              value={data?.kpis.lowStockItems ?? 0}
              icon={AlertTriangle}
              onClick={() => router.push('/inventory/products?stockHealth=low_stock')}
            />
            <KpiCard
              label="Out of Stock"
              value={data?.kpis.outOfStock ?? 0}
              icon={XCircle}
              onClick={() => router.push('/inventory/products?stockHealth=out_of_stock')}
            />
            <KpiCard label="On Order" value={data?.kpis.itemsOnOrder ?? 0} icon={Truck} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardBody className="p-5">
              <h3 className="font-semibold mb-4">Stock Health</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.stockHealth ?? []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {(data?.stockHealth ?? []).map((_, i) => (
                        <Cell key={i} fill={HEALTH_COLORS[i % HEALTH_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {(data?.stockHealth ?? []).map((s, i) => (
                  <div key={s.key} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLORS[i] }} />
                    {s.name}: {s.value}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Reorder Recommendations</h3>
                <Link href="/inventory/purchase-orders" className="text-sm text-indigo-600 flex items-center gap-1">
                  Create PO <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {(data?.reorderRecommendations ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">All products are above reorder points.</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {(data?.reorderRecommendations ?? []).map((r) => (
                    <li key={r.productId}>
                      <Link
                        href={`/inventory/products/${r.productId}`}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <div>
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="text-xs text-slate-500">{r.sku} · {r.onHand} on hand (reorder at {r.reorderPoint})</p>
                        </div>
                        <Badge variant="warning">Order {r.suggestedOrderQty}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardBody className="p-5">
              <h3 className="font-semibold mb-4">Fast-Moving Products (30d)</h3>
              <DataTable
                columns={fastCols}
                data={(data?.fastMoving ?? []) as unknown as Record<string, unknown>[]}
                loading={isLoading}
                keyField="productId"
                onRowClick={(row) => router.push(`/inventory/products/${(row as { productId: string }).productId}`)}
                emptyTitle="No sales data yet"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-5">
              <h3 className="font-semibold mb-4">Dead Stock (90d no movement)</h3>
              <DataTable
                columns={deadCols}
                data={(data?.deadStock ?? []) as unknown as Record<string, unknown>[]}
                loading={isLoading}
                keyField="productId"
                onRowClick={(row) => router.push(`/inventory/products/${(row as { productId: string }).productId}`)}
                emptyTitle="No dead stock detected"
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
