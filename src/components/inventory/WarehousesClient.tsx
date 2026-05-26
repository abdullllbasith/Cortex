'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Warehouse, MapPin, Package, DollarSign, Users } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
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

interface WarehouseCard {
  id: string
  name: string
  code: string
  address: Record<string, unknown>
  totalSkus: number
  totalValue: number
  activeStaff: number
  manager: { fullName: string } | null
}

interface WarehouseDetail {
  id: string
  name: string
  code: string
  stock: Array<{
    productId: string
    product: { sku: string; name: string }
    quantityOnHand: number
    value: number
  }>
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function WarehousesClient() {
  const { data: warehouses = [], mutate } = useSWR<WarehouseCard[]>('/inventory/warehouses', swrFetcher)
  const { data: allProducts } = useSWR<{ data: Array<{ id: string; name: string; sku: string }> }>(
    '/inventory/products?limit=100',
    swrFetcher,
  )

  const [detailId, setDetailId] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [scheduledDate, setScheduledDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newDefault, setNewDefault] = useState(true)

  const { data: detail } = useSWR<WarehouseDetail>(
    detailId ? `/inventory/warehouses/${detailId}` : null,
    swrFetcher,
  )

  const products = allProducts?.data ?? []

  const submitTransfer = async (executeNow: boolean) => {
    if (!fromId || !toId || !productId) {
      toast.error('Complete all transfer fields')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          productId,
          quantity: qty,
          scheduledDate: scheduledDate || undefined,
          executeNow,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Transfer failed')
        return
      }
      toast.success(executeNow ? 'Transfer completed' : 'Transfer scheduled')
      setTransferOpen(false)
      mutate()
      if (detailId) mutate()
    } finally {
      setSubmitting(false)
    }
  }

  const createWarehouse = async () => {
    if (!newName.trim() || !newCode.trim()) {
      toast.error('Name and code are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim(),
          isDefault: newDefault,
          address: newCity.trim() ? { city: newCity.trim() } : {},
        }),
      })
      const json = await res.json()
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to create warehouse')
        return
      }
      toast.success('Warehouse created')
      setCreateOpen(false)
      setNewName('')
      setNewCode('')
      setNewCity('')
      mutate()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Warehouses"
        subtitle="Locations, stock levels, and transfers"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Warehouses' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>Add Warehouse</Button>
            <Button onClick={() => setTransferOpen(true)}>Stock Transfer</Button>
          </div>
        }
      />

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <Card
              key={w.id}
              className="cursor-pointer hover:border-indigo-300 transition-colors"
              onClick={() => setDetailId(w.id)}
            >
              <CardBody className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950 p-2.5">
                    <Warehouse className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{w.name}</h3>
                    <p className="text-xs text-slate-500">{w.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {(w.address as { city?: string })?.city ?? 'Location not set'}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                    <Package className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-sm font-semibold tabular-nums">{w.totalSkus}</p>
                    <p className="text-[10px] text-slate-500">SKUs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                    <DollarSign className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(w.totalValue)}</p>
                    <p className="text-[10px] text-slate-500">Value</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                    <Users className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-sm font-semibold tabular-nums">{w.activeStaff}</p>
                    <p className="text-[10px] text-slate-500">Staff</p>
                  </div>
                </div>
                {w.manager && (
                  <p className="text-xs text-slate-500">Manager: {w.manager.fullName}</p>
                )}
              </CardBody>
            </Card>
          ))}
          {warehouses.length === 0 && (
            <p className="text-slate-500 col-span-full">
              No warehouses yet.{' '}
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setCreateOpen(true)}>
                Add your first warehouse
              </button>
            </p>
          )}
        </div>
      </div>

      <ModalRoot open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <ModalContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>{detail?.name ?? 'Warehouse'}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            {detail && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.stock.filter((s) => s.quantityOnHand > 0).map((s) => (
                    <tr key={s.productId} className="border-b border-slate-100">
                      <td className="py-2">
                        <p className="font-medium">{s.product.name}</p>
                        <p className="text-xs text-slate-500">{s.product.sku}</p>
                      </td>
                      <td className="py-2 text-right tabular-nums">{s.quantityOnHand}</td>
                      <td className="py-2 text-right">{formatMoney(s.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ModalBody>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={transferOpen} onOpenChange={setTransferOpen}>
        <ModalContent>
          <ModalHeader><ModalTitle>Stock Transfer</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">From warehouse</label>
              <select className={selectClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">Select</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">To warehouse</label>
              <select className={selectClass} value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Product</label>
              <select className={selectClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Quantity</label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Schedule date (optional)</label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => submitTransfer(false)} disabled={submitting}>
              Schedule
            </Button>
            <Button onClick={() => submitTransfer(true)} disabled={submitting}>
              Transfer Now
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent>
          <ModalHeader><ModalTitle>Add Warehouse</ModalTitle></ModalHeader>
          <ModalBody className="space-y-4">
            <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Main Warehouse" />
            <Input label="Code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="WH-MAIN" />
            <Input label="City (optional)" value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="New York" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newDefault} onChange={(e) => setNewDefault(e.target.checked)} />
              Set as default warehouse
            </label>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void createWarehouse()} loading={submitting}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
