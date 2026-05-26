'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, Save } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'
import { ProductVariantsTab } from '@/components/inventory/ProductVariantsTab'
import { BarcodeField } from '@/components/inventory/BarcodeField'
import { StockBadge, type StockHealth } from '@/components/inventory/StockBadge'
import { StockLevelBar } from '@/components/inventory/StockLevelBar'

type Tab = 'overview' | 'stock' | 'variants' | 'history' | 'analytics'

interface ProductDetail {
  id: string
  sku: string
  name: string
  barcode: string | null
  description: string | null
  costPrice: number
  sellingPrice: number
  minSellingPrice: number | null
  taxRate: number
  reorderPoint: number
  reorderQuantity: number
  leadTimeDays: number
  imageUrls: string[]
  isActive: boolean
  onHand: number
  stockHealth: StockHealth
  stockByWarehouse: Array<{
    warehouseId: string
    warehouse: { name: string; code: string }
    quantityOnHand: number
    quantityReserved: number
    quantityOnOrder: number
  }>
  variants: Array<{
    id: string
    name: string
    sku: string
    costPrice: number | null
    sellingPrice: number | null
    onHand: number
  }>
  stockTrend: Array<{ date: string; quantityOnHand: number }>
  analytics: {
    unitsSold30d: number
    grossMargin: { grossMargin: number; grossMarginPercent: number; revenue: number; cogs: number }
    abcClass: 'A' | 'B' | 'C'
    revenueProxy: number
  } | null
}

interface LedgerEntry {
  id: string
  transactionType: string
  quantity: number
  unitCost: number
  createdAt: string
  notes: string | null
  warehouse: { name: string; code: string }
  performer: { fullName: string } | null
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

export function ProductDetailClient({ productId }: { productId: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [form, setForm] = useState<Partial<ProductDetail>>({})
  const [ledgerType, setLedgerType] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: product, mutate, isLoading, error } = useSWR<ProductDetail>(
    `/inventory/products/${productId}`,
    swrFetcher,
  )

  const { data: analytics, isLoading: analyticsLoading } = useSWR<ProductDetail['analytics']>(
    tab === 'analytics' ? `/inventory/products/${productId}?tab=analytics` : null,
    swrFetcher,
  )

  const ledgerKey =
    tab === 'history'
      ? `/inventory/products/${productId}?tab=ledger${ledgerType ? `&transactionType=${ledgerType}` : ''}`
      : null
  const { data: ledgerPage } = useSWR<{ data: LedgerEntry[] } | LedgerEntry[]>(
    ledgerKey,
    swrFetcher,
  )
  const ledgerEntries = Array.isArray(ledgerPage) ? ledgerPage : (ledgerPage?.data ?? [])

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading product…</div>
  }

  if (error || !product) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-slate-600">Product not found or failed to load.</p>
        <Link href="/inventory/products">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to products</Button>
        </Link>
      </div>
    )
  }

  const p = {
    ...product,
    ...form,
    imageUrls: form.imageUrls ?? product.imageUrls ?? [],
    stockByWarehouse: product.stockByWarehouse ?? [],
    variants: product.variants ?? [],
    stockTrend: product.stockTrend ?? [],
    analytics: analytics ?? product.analytics,
  } as ProductDetail

  const save = async () => {
    if (!p) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Save failed')
        return
      }
      toast.success('Product saved')
      setForm({})
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const ledgerCols: ColumnDef<Record<string, unknown>>[] = [
    {
      id: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date((row as unknown as LedgerEntry).createdAt).toLocaleString(),
    },
    { id: 'transactionType', header: 'Type', accessorKey: 'transactionType' },
    { id: 'quantity', header: 'Qty', accessorKey: 'quantity', type: 'number' },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => (row as unknown as LedgerEntry).warehouse.name,
    },
    { id: 'notes', header: 'Notes', accessorKey: 'notes' },
  ]

  const imageUrls = p.imageUrls?.length ? p.imageUrls : ['']

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'stock', label: 'Stock' },
    { id: 'variants', label: 'Variants' },
    { id: 'history', label: 'History' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={p.name}
        subtitle={p.sku}
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Products', href: '/inventory/products' },
          { label: p.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/products">
              <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            </Link>
            {tab === 'overview' && Object.keys(form).length > 0 && (
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />{saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        }
      />

      <div className="border-b px-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardBody className="p-5 space-y-3">
                <h3 className="font-semibold">Images</h3>
                <div className="grid grid-cols-2 gap-2">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </div>
                  ))}
                </div>
                <Input
                  placeholder="Image URL"
                  onBlur={(e) => {
                    if (e.target.value) {
                      setForm((f) => ({ ...f, imageUrls: [...(p.imageUrls ?? []), e.target.value] }))
                    }
                  }}
                />
                <StockBadge health={p.stockHealth} />
                <p className="text-sm text-slate-500">{p.onHand} units on hand</p>
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardBody className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ['name', 'Name'],
                    ['sku', 'SKU'],
                    ['barcode', 'Barcode'],
                    ['costPrice', 'Cost Price'],
                    ['sellingPrice', 'Selling Price'],
                    ['minSellingPrice', 'Min Selling Price'],
                    ['taxRate', 'Tax Rate %'],
                    ['leadTimeDays', 'Lead Time (days)'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    {key === 'barcode' ? (
                      <BarcodeField
                        value={String((p as unknown as Record<string, unknown>).barcode ?? '')}
                        onChange={(barcode) => setForm((f) => ({ ...f, barcode }))}
                      />
                    ) : (
                      <>
                        <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                        <Input
                          defaultValue={String((p as unknown as Record<string, unknown>)[key] ?? '')}
                          onChange={(e) => {
                            const val =
                              key.includes('Price') || key === 'taxRate'
                                ? Number(e.target.value)
                                : key === 'leadTimeDays'
                                  ? Number(e.target.value)
                                  : e.target.value
                            setForm((f) => ({ ...f, [key]: val }))
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Description</label>
                  <textarea
                    className={`${selectClass} min-h-[100px] py-2`}
                    defaultValue={p.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'stock' && (
          <>
            <Card>
              <CardBody className="p-5">
                <h3 className="font-semibold mb-4">Stock by Warehouse</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="pb-2">Warehouse</th>
                      <th className="pb-2 text-right">On Hand</th>
                      <th className="pb-2 text-right">Reserved</th>
                      <th className="pb-2 text-right">On Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.stockByWarehouse.map((row) => (
                      <tr key={row.warehouseId} className="border-b border-slate-100">
                        <td className="py-2">{row.warehouse.name} ({row.warehouse.code})</td>
                        <td className="py-2 text-right tabular-nums">{row.quantityOnHand}</td>
                        <td className="py-2 text-right tabular-nums">{row.quantityReserved}</td>
                        <td className="py-2 text-right tabular-nums">{row.quantityOnOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5">
                <h3 className="font-semibold mb-4">Stock Level (90 days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={p.stockTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="quantityOnHand" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Reorder Point</label>
                  <Input
                    type="number"
                    defaultValue={p.reorderPoint}
                    onChange={(e) => setForm((f) => ({ ...f, reorderPoint: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Reorder Quantity</label>
                  <Input
                    type="number"
                    defaultValue={p.reorderQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, reorderQuantity: Number(e.target.value) }))}
                  />
                </div>
                <StockLevelBar onHand={p.onHand} reorderPoint={p.reorderPoint} className="col-span-2" />
                <Button onClick={save} disabled={saving} className="col-span-2 w-fit">
                  Save reorder settings
                </Button>
              </CardBody>
            </Card>
          </>
        )}

        {tab === 'variants' && (
          <ProductVariantsTab productId={productId} productSku={p.sku} />
        )}

        {tab === 'history' && (
          <Card>
            <CardBody className="p-5 space-y-4">
              <select className={selectClass + ' max-w-xs'} value={ledgerType} onChange={(e) => setLedgerType(e.target.value)}>
                <option value="">All transaction types</option>
                {['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGE', 'WRITE_OFF', 'OPENING'].map(
                  (t) => (
                    <option key={t} value={t}>{t}</option>
                  ),
                )}
              </select>
              <DataTable
                columns={ledgerCols}
                data={ledgerEntries as unknown as Record<string, unknown>[]}
                keyField="id"
                emptyTitle="No ledger entries"
              />
            </CardBody>
          </Card>
        )}

        {tab === 'analytics' && (
          analyticsLoading || !p.analytics ? (
            <p className="text-sm text-slate-500">Loading analytics…</p>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardBody className="p-5">
                <p className="text-sm text-slate-500">Units Sold (30d)</p>
                <p className="text-3xl font-semibold tabular-nums">{p.analytics.unitsSold30d}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5">
                <p className="text-sm text-slate-500">Gross Margin</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {p.analytics.grossMargin.grossMarginPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ${p.analytics.grossMargin.grossMargin.toFixed(2)} on ${p.analytics.grossMargin.revenue.toFixed(2)} revenue
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-5">
                <p className="text-sm text-slate-500">ABC Classification</p>
                <Badge variant={p.analytics.abcClass === 'A' ? 'success' : p.analytics.abcClass === 'B' ? 'warning' : 'default'} className="mt-2 text-lg px-3 py-1">
                  Class {p.analytics.abcClass}
                </Badge>
              </CardBody>
            </Card>
          </div>
          )
        )}
      </div>
    </div>
  )
}
