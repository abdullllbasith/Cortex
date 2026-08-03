'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Grid3X3, List, Plus, Upload, Download, FolderTree } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  toast,
  Modal,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher } from '@/lib/api/apiClient'
import { ProductCard, type ProductCardData } from '@/components/inventory/ProductCard'
import { StockBadge, type StockHealth } from '@/components/inventory/StockBadge'
import { StockLevelBar } from '@/components/inventory/StockLevelBar'
import { ImportPreviewModal, type ImportPreviewRow } from '@/components/inventory/ImportPreviewModal'

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

const TEMPLATE_CSV = [
  'name,sku,barcode,costPrice,sellingPrice,reorderPoint,reorderQuantity,categoryName,supplierId,unit,description',
  'Sample Widget,SKU-001,,10.00,19.99,5,10,Electronics,,PCS,Example product',
].join('\n')

export function ProductCatalogClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkSupplier, setBulkSupplier] = useState('')
  const [bulkCost, setBulkCost] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [importPreviewOpen, setImportPreviewOpen] = useState(false)
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([])
  const [importPreview, setImportPreview] = useState<{
    preview: ImportPreviewRow[]
    totalRows: number
    validRows: number
    errorRows: number
  } | null>(null)
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite' | 'create_new'>('skip')
  const [importing, setImporting] = useState(false)

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
    '/inventory/suppliers?limit=100',
    swrFetcher,
  )

  const products = data?.data ?? []
  const suppliers = suppliersData?.data ?? suppliersData ?? []
  const supplierList = Array.isArray(suppliers) ? suppliers : []

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCsvFile = async (file: File) => {
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
  }

  const handleImportFile = useCallback(async (file: File) => {
    const rows = await parseCsvFile(file)
    setImportRows(rows)
    const res = await fetch('/api/inventory/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rows, preview: true }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Preview failed')
      return
    }
    setImportPreview(json.data)
    setImportPreviewOpen(true)
  }, [])

  const confirmImport = async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: importRows, duplicateStrategy }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Import failed')
      toast.success(
        `Imported ${json.data.imported}, updated ${json.data.updated ?? 0}, skipped ${json.data.skipped ?? 0}`,
      )
      setImportPreviewOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const runBulk = async (action: 'update' | 'activate' | 'deactivate' | 'export') => {
    const ids = [...selected]
    if (!ids.length) return
    if (action === 'export') {
      const res = await fetch('/api/inventory/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'export', productIds: ids }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'products-export.csv'
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    const body: Record<string, unknown> = { action, productIds: ids }
    if (action === 'update') {
      body.updates = {
        ...(bulkCategory && { categoryId: bulkCategory }),
        ...(bulkSupplier && { supplierId: bulkSupplier }),
        ...(bulkCost && { costPrice: Number(bulkCost) }),
        ...(bulkPrice && { sellingPrice: Number(bulkPrice) }),
      }
    }
    const res = await fetch('/api/inventory/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Bulk action failed')
      return
    }
    toast.success(`Updated ${json.data.updated} product(s)`)
    setBulkOpen(false)
    setSelected(new Set())
    mutate()
  }

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: 'select',
        header: '',
        cell: ({ row }) => {
          const p = row as unknown as CatalogProduct
          return (
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={(e) => {
                e.stopPropagation()
                toggleSelect(p.id)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )
        },
      },
      { id: 'sku', header: 'SKU', accessorKey: 'sku', sortable: true },
      { id: 'name', header: 'Product', accessorKey: 'name', sortable: true },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => (row as unknown as CatalogProduct).category?.name ?? '—',
      },
      {
        id: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const p = row as unknown as CatalogProduct
          return (
            <StockLevelBar onHand={p.onHand} reorderPoint={p.reorderPoint} className="min-w-[120px]" />
          )
        },
      },
      {
        id: 'health',
        header: 'Status',
        cell: ({ row }) => <StockBadge health={(row as unknown as CatalogProduct).stockHealth} />,
      },
      {
        id: 'price',
        header: 'Price',
        cell: ({ row }) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
            (row as unknown as CatalogProduct).sellingPrice,
          ),
      },
    ],
    [selected],
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
            <Link href="/inventory/categories">
              <Button variant="outline" size="sm">
                <FolderTree className="h-4 w-4 mr-1" /> Categories
              </Button>
            </Link>
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
                if (f) void handleImportFile(f)
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

      {selected.size > 0 && (
        <div className="px-6 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-b flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>Bulk edit</Button>
          <Button size="sm" variant="outline" onClick={() => void runBulk('export')}>Export CSV</Button>
          <Button size="sm" variant="outline" onClick={() => void runBulk('activate')}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => void runBulk('deactivate')}>Deactivate</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

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
              {supplierList.map((s) => (
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
              <Button variant={view === 'grid' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('grid')}>
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button variant={view === 'table' ? 'primary' : 'ghost'} size="sm" onClick={() => setView('table')}>
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
              <div key={p.id} className="relative">
                <input
                  type="checkbox"
                  className="absolute top-2 left-2 z-10"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                />
                <ProductCard product={p} />
              </div>
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
                onRowClick={(row) => router.push(`/inventory/products/${(row as unknown as CatalogProduct).id}`)}
              />
            </CardBody>
          </Card>
        )}
      </div>

      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title={`Bulk edit ${selected.size} products`}>
        <div className="space-y-3">
          <select className={selectClass + ' w-full'} value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
            <option value="">— Category (no change) —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className={selectClass + ' w-full'} value={bulkSupplier} onChange={(e) => setBulkSupplier(e.target.value)}>
            <option value="">— Supplier (no change) —</option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Input placeholder="Cost price (optional)" type="number" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} />
          <Input placeholder="Selling price (optional)" type="number" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => void runBulk('update')}>Apply</Button>
          </div>
        </div>
      </Modal>

      {importPreview && (
        <ImportPreviewModal
          open={importPreviewOpen}
          onClose={() => setImportPreviewOpen(false)}
          preview={importPreview.preview}
          totalRows={importPreview.totalRows}
          validRows={importPreview.validRows}
          errorRows={importPreview.errorRows}
          duplicateStrategy={duplicateStrategy}
          onDuplicateStrategyChange={setDuplicateStrategy}
          onConfirm={() => void confirmImport()}
          importing={importing}
        />
      )}
    </div>
  )
}
