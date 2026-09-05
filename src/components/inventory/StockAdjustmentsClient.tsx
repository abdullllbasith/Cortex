'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { PageHeader, Button, Card, CardBody, Input, toast, ConfirmDialog } from '@/components/ui'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'
import { BarcodeScanner, type BarcodeScanResult } from '@/components/inventory/BarcodeScanner'

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

interface AdjustmentRow {
  id: string
  transactionType: string
  quantity: number
  notes: string | null
  createdAt: string
  product: { sku: string; name: string }
  warehouse: { name: string; code: string }
  performer: { fullName: string } | null
}

export function StockAdjustmentsClient() {
  const { data: adjustments = [], mutate } = useSWR<AdjustmentRow[]>('/inventory/adjustments', swrFetcher)
  const { data: productsData } = useSWR<{ data: Array<{ id: string; name: string; sku: string }> }>(
    '/inventory/products?limit=100',
    swrFetcher,
  )
  const { data: warehouses = [] } = useSWR<Array<{ id: string; name: string; code: string }>>(
    '/inventory/warehouses',
    swrFetcher,
  )

  const products = productsData?.data ?? productsData ?? []
  const productList = Array.isArray(products) ? products : []

  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState<string | null>(null)
  const [scannedLabel, setScannedLabel] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [kind, setKind] = useState<'increase' | 'decrease' | 'write_off' | 'damage'>('increase')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (managerConfirmed = false) => {
    if (!productId || !warehouseId || !reason.trim()) {
      toast.error('Fill in product, warehouse, and reason')
      return
    }
    setSubmitting(true)
    try {
      const res = await authFetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          variantId: variantId ?? undefined,
          warehouseId,
          kind,
          quantity,
          reason,
          notes: notes || undefined,
          managerConfirmed,
        }),
      })
      const json = await res.json()
      if (json.error?.code === 'CONFIRMATION_REQUIRED') {
        setConfirmOpen(true)
        return
      }
      if (!json.success) {
        toast.error(json.error?.message ?? 'Adjustment failed')
        return
      }
      toast.success('Stock adjustment recorded')
      setReason('')
      setNotes('')
      mutate()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Adjustments"
        subtitle="Manual inventory corrections with audit trail"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Adjustments' },
        ]}
      />

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardBody className="p-5 space-y-4">
            <h3 className="font-semibold">New Adjustment</h3>
            <BarcodeScanner
              onScan={(result: BarcodeScanResult) => {
                setProductId(result.productId)
                setVariantId(result.variantId ?? null)
                setScannedLabel(result.name)
              }}
            />
            {scannedLabel && (
              <p className="text-xs text-emerald-600">Selected: {scannedLabel}</p>
            )}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Product</label>
              <select className={selectClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {productList.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Warehouse</label>
              <select className={selectClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Type</label>
              <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
                <option value="write_off">Write-off</option>
                <option value="damage">Damage</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Quantity</label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Notes</label>
              <textarea className={`${selectClass} min-h-[80px] py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={() => submit(false)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Adjustment'}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <h3 className="font-semibold mb-4">Recent Adjustments</h3>
            <ul className="space-y-3 max-h-[520px] overflow-y-auto">
              {adjustments.length === 0 && (
                <li className="text-sm text-slate-500">No adjustments yet.</li>
              )}
              {adjustments.map((a) => (
                <li key={a.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{a.product.name}</span>
                    <span className="text-slate-500">{a.transactionType}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">
                    {a.warehouse.name} · Qty {a.quantity} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                  {a.notes && <p className="text-xs mt-1">{a.notes}</p>}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Manager confirmation required"
        description="This adjustment exceeds 10% of current stock. Confirm you are authorized to proceed."
        confirmLabel="Confirm adjustment"
        onConfirm={async () => {
          setConfirmOpen(false)
          await submit(true)
        }}
        variant="warning"
      />
    </div>
  )
}
