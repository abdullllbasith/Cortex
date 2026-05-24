'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Grid3X3, List, Plus, Upload, Download } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'
import { ProductCard, type ProductCardData } from '@/components/inventory/ProductCard'
import { StockBadge, type StockHealth } from '@/components/inventory/StockBadge'
import { StockLevelBar } from '@/components/inventory/StockLevelBar'

interface CatalogProduct extends ProductCardData {
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
  reorderPoint: number
  isActive: boolean
}

interface PaginatedProducts {
  data: CatalogProduct[]
  total: number
}

const selectClass =
  'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

export function ProductCatalogClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const stockHealth = searchParams.get('stockHealth') ?? ''

  const queryKey = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (categoryId) p.set('categoryId', categoryId)
    if (supplierId) p.set('supplierId', supplierId)
    if (status !== 'all') p.set('status', status)
    if (stockHealth) p.set('stockHealth', stockHealth)
    p.set('limit', '48')
    return `/inventory/products?${p.toString()}`
  }, [search, categoryId, supplierId, status, stockHealth])

  const { data, mutate, isLoading } = useSWR<PaginatedProducts>(queryKey, swrFetcher)
  const { data: categories = [] } = useSWR<Array<{ id: string; name: string }>>(
    '/inventory/categories',
    swrFetcher,
  )
  const { data: suppliersData } = useSWR<{ data: Array<{ id: string; name: string }> }>(
    '/suppliers?limit=100',
    swrFetcher,
  )

  const products = data?.data ?? []
  const suppliers = suppliersData?.data ?? []

  const downloadTemplate = () => {
    const csv = 'name,sku,barcode,costPrice,sellingPrice,reorderPoint,categoryId,supplierId\nSample Product,SKU-001,,10.00,19.99,5,,\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = useCallback(
    async (file: File) => {
      const text = await file.text()
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map((h) => h.trim())
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',')
        const row: Record<string, string> = {}
        headers.forEach((h, i) => {
          row[h] = vals[i]?.trim() ?? ''
        })
        return row
      })
      const res = await fetch('/api/inventory/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Import failed')
        return
      }
      toast.success(`Imported ${json.data.imported} products`)
      mutate()
    },
    [mutate],
  )

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(
    () => [
      { id: 'sku', header: 'SKU', accessorKey: 'sku', sortable: true },
      { id: 'name', header: 'Product', accessorKey: 'name', sortable: true },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => (row as CatalogProduct).category?.name ?? '—',
      },
      {
        id: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const p = row as CatalogProduct
          return (
            <StockLevelBar onHand={p.onHand} reorderPoint={p.reorderPoint} className="min-w-[120px]" />
          )
        },
      },
      {
        id: 'health',
        header: 'Status',
        cell: ({ row }) => <StockBadge health={(row as CatalogProduct).stockHealth} />,
      },
      {
        id: 'price',
        header: 'Price',
        cell: ({ row }) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            (row as CatalogProduct).sellingPrice,
          ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Product Catalogue"
        subtitle="Manage SKUs, pricing, and stock levels"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Products' },
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImport(f)
              }}
            />
            <Link href="/inventory/products/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        <Card>
          <CardBody className="p-4 flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search name, SKU, barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className={selectClass}
              value={stockHealth}
              onChange={(e) => {
                const v = e.target.value
                router.push(v ? `/inventory/products?stockHealth=${v}` : '/inventory/products')
              }}
            >
              <option value="">All stock levels</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
            <div className="ml-auto flex gap-1 border rounded-lg p-1">
              <Button variant={view === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setView('grid')}>
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button variant={view === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setView('table')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>

        {view === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {isLoading && <p className="text-slate-500 col-span-full">Loading…</p>}
            {!isLoading && products.length === 0 && (
              <p className="text-slate-500 col-span-full">No products found.</p>
            )}
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              <DataTable
                columns={columns}
                data={products as unknown as Record<string, unknown>[]}
                loading={isLoading}
                keyField="id"
                onRowClick={(row) => router.push(`/inventory/products/${(row as CatalogProduct).id}`)}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
