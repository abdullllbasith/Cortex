'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Package, Plus, Upload } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import {
  PageHeader,
  Button,
  Input,
  EmptyState,
  Badge,
  Modal,
  toast,
} from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import { StockBadge, type StockHealth } from '@/components/inventory/StockBadge'
import { useDebounce } from '@/hooks/useDebounce'

interface ProductRow extends Record<string, unknown> {
  id: string
  sku: string
  name: string
  imageUrls: string[]
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
  costPrice: number
  sellingPrice: number
  onHand: number
  stockHealth: StockHealth
  updatedAt: string
}

const selectClass =
  'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function productInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PR'
}

function ProductThumb({ name, imageUrls }: { name: string; imageUrls: string[] }) {
  if (imageUrls?.[0]) {
    return (
      <Image
        src={imageUrls[0]}
        alt=""
        width={40}
        height={40}
        className="h-full w-full object-cover"
        loading="lazy"
        unoptimized
      />
    )
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      {productInitials(name)}
    </span>
  )
}

export function ProductsKnowledgePageContent() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [stockHealth, setStockHealth] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSku, setNewSku] = useState('')
  const [newPrice, setNewPrice] = useState('0')

  const listKey = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '50')

    if (debouncedSearch.trim().length >= 2) {
      p.set('type', 'product')
      p.set('search', debouncedSearch.trim())
      p.set('semantic', 'true')
      if (categoryId) p.set('categoryId', categoryId)
      if (supplierId) p.set('supplierId', supplierId)
      if (stockHealth) p.set('stockHealth', stockHealth)
      if (minPrice) p.set('minPrice', minPrice)
      if (maxPrice) p.set('maxPrice', maxPrice)
      return `/knowledge?${p.toString()}`
    }

    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    if (categoryId) p.set('categoryId', categoryId)
    if (supplierId) p.set('supplierId', supplierId)
    if (stockHealth) p.set('stockHealth', stockHealth)
    if (minPrice) p.set('minPrice', minPrice)
    if (maxPrice) p.set('maxPrice', maxPrice)
    return `/knowledge/products?${p.toString()}`
  }, [debouncedSearch, categoryId, supplierId, stockHealth, minPrice, maxPrice])

  const { data, mutate, isLoading } = useSWR<{ data: ProductRow[]; total: number }>(
    listKey,
    swrFetcher,
  )

  const tableData = data?.data ?? []
  const isSemantic = debouncedSearch.trim().length >= 2

  const handleImport = useCallback(async (file: File) => {
    const text = await file.text()
    const res = await fetch('/api/inventory/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      credentials: 'include',
      body: text,
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Import failed')
      return
    }
    toast.success(`Imported ${json.data?.imported ?? 0} products`)
    mutate()
  }, [mutate])

  async function createProduct() {
    if (!newName.trim()) {
      toast.error('Product name is required')
      return
    }
    try {
      await apiClient.post('/knowledge/products', {
        name: newName.trim(),
        sku: newSku.trim() || undefined,
        sellingPrice: Number(newPrice) || 0,
      })
      toast.success('Product created')
      setCreateOpen(false)
      setNewName('')
      setNewSku('')
      setNewPrice('0')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create product')
    }
  }

  async function deleteProduct(row: ProductRow) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/knowledge/products/${row.id}`)
      toast.success('Product deleted')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnDef<ProductRow>[] = [
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => (
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <ProductThumb name={row.name} imageUrls={row.imageUrls} />
        </div>
      ),
    },
    { id: 'sku', header: 'SKU', accessorKey: 'sku' },
    { id: 'name', header: 'Name', accessorKey: 'name' },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => row.category?.name ?? '—',
    },
    { id: 'costPrice', header: 'Cost Price', accessorKey: 'costPrice', type: 'currency' },
    { id: 'sellingPrice', header: 'Selling Price', accessorKey: 'sellingPrice', type: 'currency' },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => row.supplier?.name ?? '—',
    },
    {
      id: 'stock',
      header: 'Stock',
      cell: ({ row }) => <StockBadge health={row.stockHealth} />,
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => new Date(row.updatedAt).toLocaleDateString(),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Product Knowledge"
        subtitle="Product catalogue for AI search, workflows, and inventory"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: 'Products' },
        ]}
        actions={(
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Product
            </Button>
          </div>
        )}
      />

      <ResponsiveContainer className="flex-1 space-y-4 py-6">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Semantic search products (name, SKU, description)…"
          aria-label="Product knowledge search"
        />

        <div className="flex flex-wrap gap-2">
          <CategoryOptions categoryId={categoryId} onCategoryId={setCategoryId} selectClass={selectClass} />
          <SupplierFilterOptions supplierId={supplierId} onSupplierId={setSupplierId} selectClass={selectClass} />
          <select className={selectClass} value={stockHealth} onChange={(e) => setStockHealth(e.target.value)}>
            <option value="">All stock levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low</option>
            <option value="out_of_stock">Out</option>
          </select>
          <Input type="number" placeholder="Min price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-28" />
          <Input type="number" placeholder="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" />
          {isSemantic && (
            <Badge variant="info" size="sm">AI search: {debouncedSearch}</Badge>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImport(file)
            e.target.value = ''
          }}
        />

        {!isLoading && tableData.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title="No products yet"
            description="Add your first product to the knowledge base and inventory."
            action={{ label: 'Add your first product', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            loading={isLoading}
            skeletonRowCount={8}
            keyField="id"
            onRowClick={(row) => router.push(`/knowledge/products/${row.id}`)}
            rowActions={(row) => (
              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <Link href={`/knowledge/products/${row.id}`} className="text-xs text-indigo-600 hover:underline">
                  Edit
                </Link>
                <Link href={`/inventory/products/${row.id}`} className="text-xs text-slate-600 hover:underline">
                  Inventory
                </Link>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => void deleteProduct(row)}
                >
                  Delete
                </button>
              </div>
            )}
            emptyTitle="No products match your filters"
          />
        )}
      </ResponsiveContainer>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add product"
        footer={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={createProduct}>Create</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Input label="SKU" value={newSku} onChange={(e) => setNewSku(e.target.value)} />
          <Input label="Selling price" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

function CategoryOptions({
  categoryId,
  onCategoryId,
  selectClass,
}: {
  categoryId: string
  onCategoryId: (v: string) => void
  selectClass: string
}) {
  const { data: categories = [] } = useSWR<Array<{ id: string; name: string }>>(
    '/inventory/categories',
    swrFetcher,
  )
  return (
    <select className={selectClass} value={categoryId} onChange={(e) => onCategoryId(e.target.value)}>
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}

function SupplierFilterOptions({
  supplierId,
  onSupplierId,
  selectClass,
}: {
  supplierId: string
  onSupplierId: (v: string) => void
  selectClass: string
}) {
  const { data: suppliersData } = useSWR<{ data: Array<{ id: string; name: string }> }>(
    '/knowledge/suppliers?limit=100',
    swrFetcher,
  )
  return (
    <select className={selectClass} value={supplierId} onChange={(e) => onSupplierId(e.target.value)}>
      <option value="">All suppliers</option>
      {(suppliersData?.data ?? []).map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )
}
