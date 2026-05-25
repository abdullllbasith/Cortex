'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  toast,
} from '@/components/ui'
import { swrFetcher, apiClient } from '@/lib/api/apiClient'
import { calculateLineTotal, calculateOrderTotals, type SalesLineItem } from '@/lib/sales/salesTypes'

interface ContactOption {
  id: string
  fullName: string
}

interface ProductOption {
  id: string
  name: string
  sku: string
  sellingPrice: number
  taxRate: number
}

function emptyLine(): SalesLineItem {
  return {
    productId: null,
    variantId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxRate: 0,
    lineTotal: 0,
  }
}

function StockHint({ productId }: { productId: string | null }) {
  const { data } = useSWR<Array<{ quantityAvailable: number }>>(
    productId ? `/inventory/products/${productId}/stock` : null,
    swrFetcher,
  )
  if (!productId) return null
  const available = (data ?? []).reduce((s, b) => s + b.quantityAvailable, 0)
  const ok = available > 0
  return (
    <span className={`text-xs ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
      Stock: {available}
    </span>
  )
}

export function OrderNewClient() {
  const router = useRouter()
  const [contactSearch, setContactSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState('')
  const [items, setItems] = useState<SalesLineItem[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const contactQuery =
    contactSearch.length >= 2 ? `/crm/contacts?search=${encodeURIComponent(contactSearch)}&limit=8` : null
  const { data: contactData } = useSWR<{
    items: Array<{ id: string; firstName: string; lastName: string }>
  }>(contactQuery, swrFetcher)
  const contacts: ContactOption[] = (contactData?.items ?? []).map((c) => ({
    id: c.id,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
  }))

  const productQuery =
    productSearch.length >= 2 ? `/inventory/products?search=${encodeURIComponent(productSearch)}&limit=8` : null
  const { data: productData } = useSWR<{ items: ProductOption[] }>(productQuery, swrFetcher)
  const products = productData?.items ?? []

  const totals = useMemo(() => {
    const normalized = items.map((item) => ({ ...item, lineTotal: calculateLineTotal(item) }))
    return { ...calculateOrderTotals(normalized), lines: normalized }
  }, [items])

  const updateLine = (index: number, patch: Partial<SalesLineItem>) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        return { ...next, lineTotal: calculateLineTotal(next) }
      }),
    )
  }

  const confirmOrder = useCallback(async () => {
    if (!contactId) {
      toast.error('Select a contact')
      return
    }
    if (!items.some((i) => i.description && i.quantity > 0)) {
      toast.error('Add at least one line item')
      return
    }
    setSaving(true)
    try {
      const created = await apiClient.post<{ id: string; orderNumber: string }>('/sales/orders', {
        contactId,
        items: totals.lines.map(
          ({ productId, description, quantity, unitPrice, discount, taxRate, lineTotal }) => ({
            productId,
            description,
            quantity,
            unitPrice,
            discount,
            taxRate,
            lineTotal,
          }),
        ),
        notes: notes || null,
      })
      await apiClient.post(`/sales/orders/${created.id}/confirm`)
      toast.success(`Order ${created.orderNumber} confirmed — stock reserved`)
      router.push(`/sales/orders/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm order')
    } finally {
      setSaving(false)
    }
  }, [contactId, items, totals.lines, notes, router])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="New Order"
        subtitle="Create and confirm a sales order"
        breadcrumbs={[
          { label: 'Sales', href: '/sales/orders' },
          { label: 'Orders', href: '/sales/orders' },
          { label: 'New' },
        ]}
        actions={
          <Button size="sm" disabled={saving} onClick={() => void confirmOrder()}>
            Confirm order
          </Button>
        }
      />

      <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4 p-4">
              <div className="relative">
                <label className="text-xs font-medium text-slate-500">Contact</label>
                <Input
                  placeholder="Search contacts…"
                  value={contactSearch || selectedContactLabel}
                  onChange={(e) => {
                    setContactSearch(e.target.value)
                    setSelectedContactLabel('')
                    setContactId(null)
                  }}
                />
                {contacts.length > 0 && contactSearch && !contactId && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg dark:bg-slate-900">
                    {contacts.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            setContactId(c.id)
                            setSelectedContactLabel(c.fullName)
                            setContactSearch('')
                          }}
                        >
                          {c.fullName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="relative">
                <label className="text-xs font-medium text-slate-500">Add product</label>
                <Input
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {products.length > 0 && productSearch && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg dark:bg-slate-900">
                    {products.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            const idx = items.findIndex((i) => !i.description)
                            const target = idx >= 0 ? idx : items.length
                            if (idx < 0) setItems((prev) => [...prev, emptyLine()])
                            updateLine(target, {
                              productId: p.id,
                              description: p.name,
                              unitPrice: p.sellingPrice,
                              taxRate: p.taxRate,
                              sku: p.sku,
                            })
                            setProductSearch('')
                          }}
                        >
                          {p.name} ({p.sku})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left dark:bg-slate-800/50">
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 w-20">Qty</th>
                    <th className="px-3 py-2 w-24">Price</th>
                    <th className="px-3 py-2 w-24">Stock</th>
                    <th className="px-3 py-2 w-24 text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-3 py-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StockHint productId={item.productId} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.lineTotal.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, emptyLine()])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add line
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Totals</h3>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{totals.total.toFixed(2)}</span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardBody>
          </Card>
          <Link href="/sales/orders">
            <Button variant="ghost" size="sm" className="w-full">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
