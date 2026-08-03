'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  Textarea,
  toast,
} from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { EmbeddingStatusBadge } from './EmbeddingStatusBadge'
import { KnowledgeCard } from './KnowledgeCard'
import { ProductImageUpload } from './ProductImageUpload'
import { StockBadge } from '@/components/inventory/StockBadge'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

interface ProductDetail {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: string | null
  unit: string
  costPrice: number
  sellingPrice: number
  minSellingPrice: number | null
  taxRate: number
  supplierId: string | null
  reorderPoint: number
  reorderQuantity: number
  leadTimeDays: number
  imageUrls: string[]
  embeddingStatus: string
  embeddingUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
  onHand: number
  stockHealth: string
  stockByWarehouse: Array<{
    warehouseId: string
    warehouse: { id: string; name: string; code: string }
    quantityOnHand: number
    quantityReserved: number
    quantityOnOrder: number
  }>
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

export function ProductKnowledgeDetailClient({ productId }: { productId: string }) {
  const { data: product, mutate, isLoading, error } = useSWR<ProductDetail>(
    `/knowledge/products/${productId}`,
    swrFetcher,
  )
  const { data: similar = [] } = useSWR<SemanticSearchResult[]>(
    product ? `/knowledge/similar?entityType=product&entityId=${productId}&topK=5` : null,
    swrFetcher,
  )
  const { data: categories = [] } = useSWR<Array<{ id: string; name: string }>>(
    '/inventory/categories',
    swrFetcher,
  )
  const { data: suppliersData } = useSWR<{ data: Array<{ id: string; name: string }> }>(
    '/knowledge/suppliers?limit=100',
    swrFetcher,
  )

  const [form, setForm] = useState<Partial<ProductDetail>>({})
  const [saving, setSaving] = useState(false)

  const p = product ? { ...product, ...form } : null

  function setField<K extends keyof ProductDetail>(key: K, value: ProductDetail[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!product) return
    setSaving(true)
    try {
      await apiClient.put(`/knowledge/products/${productId}`, {
        ...form,
        version: product.version,
      })
      toast.success('Product saved — re-embedding queued')
      setForm({})
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    )
  }

  if (error || !p) {
    return (
      <div className="p-6">
        <p className="text-slate-600 mb-3">Product not found.</p>
        <Link href="/knowledge/products"><Button variant="secondary" size="sm">Back</Button></Link>
      </div>
    )
  }

  const dirty = Object.keys(form).length > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={p.name}
        subtitle={p.sku}
        breadcrumbs={[
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: 'Products', href: '/knowledge/products' },
          { label: p.name },
        ]}
        actions={(
          <div className="flex gap-2 items-center">
            <EmbeddingStatusBadge status={p.embeddingStatus} />
            <Link href="/knowledge/products">
              <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            </Link>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              <Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      />

      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody className="p-5 space-y-8">
              <FormSection title="Basic Info">
                <Input label="Name" value={p.name} onChange={(e) => setField('name', e.target.value)} />
                <Input label="SKU" value={p.sku} onChange={(e) => setField('sku', e.target.value)} />
                <Input label="Barcode" value={p.barcode ?? ''} onChange={(e) => setField('barcode', e.target.value || null)} />
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category</label>
                  <select
                    className={selectClass}
                    value={p.categoryId ?? ''}
                    onChange={(e) => setField('categoryId', e.target.value || null)}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Unit</label>
                  <select className={selectClass} value={p.unit} onChange={(e) => setField('unit', e.target.value)}>
                    {['PCS', 'KG', 'L', 'M', 'BOX', 'PACK'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Textarea label="Description" value={p.description ?? ''} onChange={(e) => setField('description', e.target.value)} rows={4} />
                </div>
              </FormSection>

              <FormSection title="Pricing">
                <Input label="Cost price" type="number" value={String(p.costPrice)} onChange={(e) => setField('costPrice', Number(e.target.value))} />
                <Input label="Selling price" type="number" value={String(p.sellingPrice)} onChange={(e) => setField('sellingPrice', Number(e.target.value))} />
                <Input
                  label="Min selling price"
                  type="number"
                  value={p.minSellingPrice != null ? String(p.minSellingPrice) : ''}
                  onChange={(e) => setField('minSellingPrice', e.target.value ? Number(e.target.value) : null)}
                />
                <Input label="Tax rate %" type="number" value={String(p.taxRate)} onChange={(e) => setField('taxRate', Number(e.target.value))} />
              </FormSection>

              <FormSection title="Inventory">
                <Input label="Reorder point" type="number" value={String(p.reorderPoint)} onChange={(e) => setField('reorderPoint', Number(e.target.value))} />
                <Input label="Reorder quantity" type="number" value={String(p.reorderQuantity)} onChange={(e) => setField('reorderQuantity', Number(e.target.value))} />
                <Input label="Lead time (days)" type="number" value={String(p.leadTimeDays)} onChange={(e) => setField('leadTimeDays', Number(e.target.value))} />
              </FormSection>

              <FormSection title="Supplier">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Supplier</label>
                  <select
                    className={selectClass}
                    value={p.supplierId ?? ''}
                    onChange={(e) => setField('supplierId', e.target.value || null)}
                  >
                    <option value="">None</option>
                    {(suppliersData?.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </FormSection>

              <FormSection title="Images">
                <div className="md:col-span-2">
                  <ProductImageUpload
                    productId={productId}
                    imageUrls={p.imageUrls ?? []}
                    onChange={(urls) => setField('imageUrls', urls)}
                  />
                </div>
              </FormSection>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5 space-y-5">
              <div>
                <h3 className="font-semibold mb-2">Stock by warehouse</h3>
                <div className="flex items-center gap-2 mb-3">
                  <StockBadge health={p.stockHealth as 'in_stock' | 'low_stock' | 'out_of_stock'} />
                  <span className="text-sm text-slate-500">{p.onHand} total on hand</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b">
                      <th className="text-left py-1">Warehouse</th>
                      <th className="text-right py-1">On hand</th>
                      <th className="text-right py-1">On order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.stockByWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-2 text-slate-400">No stock balances yet</td>
                      </tr>
                    ) : (
                      p.stockByWarehouse.map((row) => (
                        <tr key={row.warehouseId} className="border-b border-slate-100">
                          <td className="py-1">{row.warehouse.name}</td>
                          <td className="py-1 text-right tabular-nums">{row.quantityOnHand}</td>
                          <td className="py-1 text-right tabular-nums">{row.quantityOnOrder}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Link href={`/inventory/products/${productId}`} className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
                  View in Inventory →
                </Link>
              </div>

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <h3 className="font-semibold mb-2">Embedding</h3>
                <EmbeddingStatusBadge status={p.embeddingStatus} />
                <p className="mt-2 text-xs text-slate-500">
                  Last indexed:{' '}
                  {p.embeddingUpdatedAt
                    ? new Date(p.embeddingUpdatedAt).toLocaleString()
                    : 'Not indexed yet'}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1 dark:border-slate-800">
                <p>Created: {new Date(p.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(p.updatedAt).toLocaleString()}</p>
              </div>

              {similar.filter((s) => s.id !== productId).length > 0 && (
                <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="font-semibold mb-2 text-sm">Similar products</h3>
                  <div className="space-y-2">
                    {similar.filter((s) => s.id !== productId).slice(0, 5).map((item) => (
                      <KnowledgeCard
                        key={item.id}
                        id={item.id}
                        entityType="product"
                        title={item.title}
                        snippet={item.snippet}
                        similarity={item.similarity}
                        embeddingStatus={item.embeddingStatus}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </ResponsiveContainer>
    </div>
  )
}
