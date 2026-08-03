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
  ShoppingCart,
} from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Skeleton } from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'
import { useReorderSuggestionCount } from '@/hooks/useReorderSuggestionCount'
import { cn } from '@/lib/utils'

const INVENTORY_NAV = [
  { href: '/inventory/products', label: 'Products' },
  { href: '/inventory/categories', label: 'Categories' },
  { href: '/inventory/purchase-orders', label: 'Purchase Orders' },
  { href: '/inventory/suppliers', label: 'Suppliers' },
  { href: '/inventory/reorder', label: 'Reorder Centre' },
  { href: '/inventory/adjustments', label: 'Adjustments' },
  { href: '/inventory/warehouses', label: 'Warehouses' },
] as const

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

type KpiTone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'

const KPI_TONES: Record<
  KpiTone,
  { card: string; iconWrap: string; icon: string; value: string; hover: string }
> = {
  indigo: {
    card: 'border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20',
    iconWrap: 'bg-indigo-100 dark:bg-indigo-900/50',
    icon: 'text-indigo-600 dark:text-indigo-400',
    value: 'text-indigo-950 dark:text-indigo-100',
    hover: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-950 dark:text-emerald-100',
    hover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  amber: {
    card: 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/50',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-950 dark:text-amber-100',
    hover: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  rose: {
    card: 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20',
    iconWrap: 'bg-rose-100 dark:bg-rose-900/50',
    icon: 'text-rose-600 dark:text-rose-400',
    value: 'text-rose-950 dark:text-rose-100',
    hover: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  sky: {
    card: 'border-sky-200/80 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20',
    iconWrap: 'bg-sky-100 dark:bg-sky-900/50',
    icon: 'text-sky-600 dark:text-sky-400',
    value: 'text-sky-950 dark:text-sky-100',
    hover: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'indigo',
  href,
  onClick,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  tone?: KpiTone
  href?: string
  onClick?: () => void
}) {
  const t = KPI_TONES[tone]
  const clickable = Boolean(href || onClick)
  const inner = (
    <Card className={cn(t.card, clickable && cn('cursor-pointer transition-colors', t.hover))}>
      <CardBody className="flex items-center gap-4 p-4">
        <div className={cn('rounded-lg p-2.5', t.iconWrap)}>
          <Icon className={cn('h-5 w-5', t.icon)} />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className={cn('font-display text-2xl font-semibold tabular-nums', t.value)}>{value}</p>
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
  const reorderCount = useReorderSuggestionCount()
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
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Inventory sections">
            {INVENTORY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm',
                  'transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2',
                  'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {reorderCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Reorder required</p>
                <p className="text-sm opacity-90">
                  {reorderCount} product{reorderCount === 1 ? '' : 's'} below reorder point — review suggestions and create draft POs.
                </p>
              </div>
            </div>
            <Link
              href="/inventory/reorder"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              <ShoppingCart className="h-4 w-4" />
              Open reorder centre
            </Link>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Total SKUs"
              value={data?.kpis.totalSkus ?? 0}
              icon={Package}
              tone="indigo"
              href="/inventory/products"
            />
            <KpiCard
              label="Inventory Value"
              value={formatMoney(data?.kpis.totalInventoryValue ?? 0)}
              icon={DollarSign}
              tone="emerald"
            />
            <KpiCard
              label="Low Stock"
              value={data?.kpis.lowStockItems ?? 0}
              icon={AlertTriangle}
              tone="amber"
              onClick={() => router.push('/inventory/products?stockHealth=low_stock')}
            />
            <KpiCard
              label="Out of Stock"
              value={data?.kpis.outOfStock ?? 0}
              icon={XCircle}
              tone="rose"
              onClick={() => router.push('/inventory/products?stockHealth=out_of_stock')}
            />
            <KpiCard
              label="On Order"
              value={data?.kpis.itemsOnOrder ?? 0}
              icon={Truck}
              tone="sky"
            />
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
                <Link href="/inventory/reorder" className="text-sm text-indigo-600 flex items-center gap-1">
                  Reorder centre <ArrowRight className="h-3 w-3" />
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
