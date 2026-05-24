'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Input,
  toast,
} from '@/components/ui'
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/Modal'
import { swrFetcher } from '@/lib/api/apiClient'

interface LineDraft {
  productId: string
  quantity: number
  unitCost: number
  taxRate: number
}

interface CreatePOModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  suppliers: Array<{ id: string; name: string }>
  warehouses: Array<{ id: string; name: string; code: string }>
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

export function CreatePOModal({
  open,
  onClose,
  onCreated,
  suppliers,
  warehouses,
}: CreatePOModalProps) {
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [terms, setTerms] = useState('Net 30')
  const [notes, setNotes] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', quantity: 1, unitCost: 0, taxRate: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)

  const { data: productsData } = useSWR<{ data: Array<{ id: string; name: string; sku: string; costPrice?: number }> }>(
    open ? '/products?limit=100' : null,
    swrFetcher,
  )
  const products = productsData?.data ?? []

  useEffect(() => {
    if (!open) return
    if (!warehouseId && warehouses.length) {
      setWarehouseId(warehouses[0].id)
    }
  }, [open, warehouseId, warehouses])

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', quantity: 1, unitCost: 0, taxRate: 0 }])
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!supplierId || !warehouseId) {
      toast.error('Select supplier and warehouse')
      return
    }
    const validLines = lines.filter((l) => l.productId && l.quantity > 0)
    if (!validLines.length) {
      toast.error('Add at least one line item')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId,
          warehouseId,
          shippingCost,
          expectedDelivery: expectedDelivery ? new Date(expectedDelivery).toISOString() : null,
          terms,
          notes: notes || null,
          items: validLines,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to create PO')
        return
      }
      onCreated()
      setSupplierId('')
      setLines([{ productId: '', quantity: 1, unitCost: 0, taxRate: 0 }])
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalRoot open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent className="max-w-3xl">
        <ModalHeader>
          <ModalTitle>Create Purchase Order</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Supplier</label>
              <select
                className={selectClass}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Warehouse</label>
              <select
                className={selectClass}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Expected Delivery</label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Shipping Cost</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Terms</label>
            <Input value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3">
                <div className="col-span-12 md:col-span-5">
                  <label className="text-xs text-slate-500 mb-1 block">Product</label>
                  <select
                    className={selectClass}
                    value={line.productId}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value)
                      updateLine(index, {
                        productId: e.target.value,
                        unitCost: product?.costPrice ? Number(product.costPrice) : line.unitCost,
                      })
                    }}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Unit Cost</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => updateLine(index, { unitCost: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Tax %</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.taxRate}
                    onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              className={`${selectClass} min-h-[80px] py-2`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create PO'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}
