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
  Badge,
  toast,
} from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { EmbeddingStatusBadge } from './EmbeddingStatusBadge'
import { KnowledgeCard } from './KnowledgeCard'
import { apiClient, swrFetcher } from '@/lib/api/apiClient'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

interface SupplierDetail {
  id: string
  code: string
  name: string
  type: string
  contactName: string
  contactEmail: string
  contactPhone: string
  address: string
  paymentTerms: string
  currency: string
  taxNumber: string
  leadTimeDays: number
  notes: string
  isActive: boolean
  embeddingStatus: string
  embeddingUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
  supplierMetrics: {
    onTimeDeliveryRate: number | null
    avgDelayDays: number | null
    costVariancePercent: number | null
    sampleReceipts: number
  }
  recentPurchaseOrders: Array<{
    id: string
    poNumber: string
    status: string
    grandTotal: number
    expectedDelivery: string | null
    createdAt: string
  }>
  suppliedProducts: Array<{
    id: string
    name: string
    sku: string
    unitCost: number
    leadTimeDays: number
    isPreferred: boolean
  }>
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

const SUPPLIER_TYPES = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'SERVICE_PROVIDER'] as const
const PAYMENT_TERMS = ['IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60'] as const

function poStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' | 'info' {
  if (status === 'RECEIVED') return 'success'
  if (status === 'CANCELLED') return 'danger'
  if (status === 'PARTIAL') return 'warning'
  if (status === 'SENT' || status === 'ACKNOWLEDGED') return 'info'
  return 'default'
}

export function SupplierKnowledgeDetailClient({ supplierId }: { supplierId: string }) {
  const { data: supplier, mutate, isLoading, error } = useSWR<SupplierDetail>(
    `/knowledge/suppliers/${supplierId}`,
    swrFetcher,
  )
  const { data: similar = [] } = useSWR<SemanticSearchResult[]>(
    supplier ? `/knowledge/similar?entityType=supplier&entityId=${supplierId}&topK=5` : null,
    swrFetcher,
  )

  const [form, setForm] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const s = supplier
    ? {
        ...supplier,
        isActive: form.isActive !== undefined ? Boolean(form.isActive) : supplier.isActive,
        ...form,
      }
    : null

  function setField(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!supplier) return
    setSaving(true)
    try {
      await apiClient.put(`/knowledge/suppliers/${supplierId}`, {
        ...form,
        version: supplier.version,
      })
      toast.success('Supplier saved — re-embedding queued')
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

  if (error || !s) {
    return (
      <div className="p-6">
        <p className="text-slate-600 mb-3">Supplier not found.</p>
        <Link href="/knowledge/suppliers"><Button variant="secondary" size="sm">Back</Button></Link>
      </div>
    )
  }

  const m = s.supplierMetrics
  const dirty = Object.keys(form).length > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={s.name}
        subtitle={s.code || s.contactEmail || 'Supplier profile'}
        breadcrumbs={[
          { label: 'Knowledge Base', href: '/knowledge' },
          { label: 'Suppliers', href: '/knowledge/suppliers' },
          { label: s.name },
        ]}
        actions={(
          <div className="flex gap-2 items-center">
            <EmbeddingStatusBadge status={s.embeddingStatus} />
            <Link href="/knowledge/suppliers">
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
            <CardBody className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Name" value={String(s.name)} onChange={(e) => setField('name', e.target.value)} />
              <Input label="Code" value={String(s.code)} onChange={(e) => setField('code', e.target.value)} />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Type</label>
                <select
                  className={selectClass}
                  value={String(s.type)}
                  onChange={(e) => setField('type', e.target.value)}
                >
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <Input label="Contact name" value={String(s.contactName)} onChange={(e) => setField('contactName', e.target.value)} />
              <Input label="Email" type="email" value={String(s.contactEmail)} onChange={(e) => setField('contactEmail', e.target.value)} />
              <Input label="Phone" value={String(s.contactPhone)} onChange={(e) => setField('contactPhone', e.target.value)} />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Payment terms</label>
                <select
                  className={selectClass}
                  value={String(s.paymentTerms)}
                  onChange={(e) => setField('paymentTerms', e.target.value)}
                >
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t} value={t}>{t.replace('NET', 'Net ')}</option>
                  ))}
                </select>
              </div>
              <Input label="Lead time (days)" type="number" value={String(s.leadTimeDays)} onChange={(e) => setField('leadTimeDays', Number(e.target.value))} />
              <Input label="Currency" value={String(s.currency)} onChange={(e) => setField('currency', e.target.value)} />
              <Input label="Tax number" value={String(s.taxNumber)} onChange={(e) => setField('taxNumber', e.target.value)} />
              <div className="md:col-span-2">
                <Textarea label="Address" value={String(s.address)} onChange={(e) => setField('address', e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <Textarea label="Notes" value={String(s.notes)} onChange={(e) => setField('notes', e.target.value)} rows={3} />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={s.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                Active supplier
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5 space-y-5">
              <div>
                <h3 className="font-semibold mb-1">Performance</h3>
                <p className="text-xs text-slate-500 mb-3">
                  From {m.sampleReceipts} completed receipt{m.sampleReceipts === 1 ? '' : 's'} vs PO expected dates
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">On-time delivery</span>
                    <span>{m.onTimeDeliveryRate != null ? `${m.onTimeDeliveryRate}%` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg delay</span>
                    <span>{m.avgDelayDays != null ? `${m.avgDelayDays} days` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cost variance</span>
                    <span>{m.costVariancePercent != null ? `${m.costVariancePercent}%` : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <h3 className="font-semibold mb-2 text-sm">Embedding</h3>
                <EmbeddingStatusBadge status={s.embeddingStatus} />
                <p className="mt-2 text-xs text-slate-500">
                  Last indexed:{' '}
                  {s.embeddingUpdatedAt
                    ? new Date(s.embeddingUpdatedAt).toLocaleString()
                    : 'Not indexed yet'}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1 dark:border-slate-800">
                <p>Created: {new Date(s.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(s.updatedAt).toLocaleString()}</p>
              </div>

              {similar.filter((item) => item.id !== supplierId).length > 0 && (
                <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="font-semibold mb-2 text-sm">Similar suppliers</h3>
                  <div className="space-y-2">
                    {similar.filter((item) => item.id !== supplierId).slice(0, 5).map((item) => (
                      <KnowledgeCard
                        key={item.id}
                        id={item.id}
                        entityType="supplier"
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

        {s.recentPurchaseOrders.length > 0 && (
          <Card>
            <CardBody className="p-5">
              <h3 className="font-semibold mb-3">Recent purchase orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-4">PO #</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2">Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentPurchaseOrders.map((po) => (
                      <tr key={po.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-medium">{po.poNumber}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={poStatusVariant(po.status)} size="sm">{po.status}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          ${po.grandTotal.toLocaleString()}
                        </td>
                        <td className="py-2 text-slate-500">
                          {po.expectedDelivery
                            ? new Date(po.expectedDelivery).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {s.suppliedProducts.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3">Products supplied</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {s.suppliedProducts.map((p) => (
                <KnowledgeCard
                  key={p.id}
                  id={p.id}
                  entityType="product"
                  title={p.name}
                  snippet={`${p.sku} · $${p.unitCost.toFixed(2)} unit cost`}
                />
              ))}
            </div>
          </section>
        )}
      </ResponsiveContainer>
    </div>
  )
}
