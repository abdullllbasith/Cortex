'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, Save, Send, ArrowRightCircle, CheckCircle2 } from 'lucide-react'
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
  email: string | null
  company: string | null
}

interface ProductOption {
  id: string
  name: string
  sku: string
  sellingPrice: number
  taxRate: number
  inventoryLevel?: number
}

interface QuoteDetail {
  id?: string
  status?: string
  contactId: string | null
  dealId: string | null
  items: SalesLineItem[]
  notes: string | null
  termsAndConditions: string | null
  validUntil: string | null
  contact?: { firstName: string; lastName: string } | null
}

interface DealOption {
  id: string
  title: string
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

export function QuoteBuilderClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')

  const [contactSearch, setContactSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [dealId, setDealId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState('')
  const [items, setItems] = useState<SalesLineItem[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Payment due within 30 days of acceptance.')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [quoteStatus, setQuoteStatus] = useState<string>('DRAFT')

  const { data: existing } = useSWR<QuoteDetail>(
    editId ? `/sales/quotes/${editId}` : null,
    swrFetcher,
  )

  useEffect(() => {
    if (!existing) return
    setContactId(existing.contactId)
    setDealId(existing.dealId)
    setItems(existing.items?.length ? existing.items : [emptyLine()])
    setNotes(existing.notes ?? '')
    setTerms(existing.termsAndConditions ?? '')
    setValidUntil(existing.validUntil ? existing.validUntil.slice(0, 10) : '')
    if (existing.contact) {
      setSelectedContactLabel(`${existing.contact.firstName} ${existing.contact.lastName}`.trim())
    }
    if (existing.status) setQuoteStatus(existing.status)
  }, [existing])

  const { data: dealsData } = useSWR<{ open: DealOption[] }>(
    contactId ? `/crm/contacts/${contactId}/deals` : null,
    swrFetcher,
  )
  const deals = dealsData?.open ?? []

  const contactQuery = contactSearch.length >= 2 ? `/crm/contacts?search=${encodeURIComponent(contactSearch)}&limit=8` : null
  const { data: contactData } = useSWR<{ items: Array<{ id: string; firstName: string; lastName: string; email: string | null; company: string | null }> }>(
    contactQuery,
    swrFetcher,
  )
  const contacts: ContactOption[] = (contactData?.items ?? []).map((c) => ({
    id: c.id,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    company: c.company,
  }))

  const productQuery = productSearch.length >= 2 ? `/inventory/products?search=${encodeURIComponent(productSearch)}&limit=8` : null
  const { data: productData } = useSWR<{ items: Array<{ id: string; name: string; sku: string; sellingPrice: number; taxRate: number }> }>(
    productQuery,
    swrFetcher,
  )
  const products: ProductOption[] = productData?.items ?? []

  const totals = useMemo(() => {
    const normalized = items.map((item) => ({
      ...item,
      lineTotal: calculateLineTotal(item),
    }))
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

  const addProductToLine = (product: ProductOption, index: number) => {
    updateLine(index, {
      productId: product.id,
      description: product.name,
      unitPrice: product.sellingPrice,
      taxRate: product.taxRate,
      sku: product.sku,
    })
    setProductSearch('')
  }

  const saveQuote = useCallback(
    async (sendAfter = false) => {
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
        const payload = {
          contactId,
          dealId,
          items: totals.lines,
          notes,
          termsAndConditions: terms,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          status: sendAfter ? 'SENT' : 'DRAFT',
        }
        let quoteId = editId
        if (editId) {
          await apiClient.put(`/sales/quotes/${editId}`, payload)
        } else {
          const created = await apiClient.post<{ id: string }>('/sales/quotes', payload)
          quoteId = created.id
        }
        if (sendAfter && quoteId) {
          await apiClient.post(`/sales/quotes/${quoteId}/send`)
          toast.success('Quote saved and sent')
        } else {
          toast.success('Quote saved')
        }
        router.push('/sales/quotes')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [contactId, dealId, items, totals.lines, notes, terms, validUntil, editId, router],
  )

  const convertToOrder = async () => {
    if (!editId) {
      toast.error('Save the quote first')
      return
    }
    setSaving(true)
    try {
      const order = await apiClient.post<{ id: string }>(`/sales/quotes/${editId}/convert`)
      toast.success('Order created')
      router.push(`/sales/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Convert failed')
    } finally {
      setSaving(false)
    }
  }

  const acceptQuote = async () => {
    if (!editId) return
    setSaving(true)
    try {
      const order = await apiClient.post<{ id: string }>(`/sales/quotes/${editId}/accept`)
      toast.success('Quote accepted')
      router.push(`/sales/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Accept failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={editId ? 'Edit Quote' : 'New Quote'}
        subtitle="Build a quotation for your customer"
        breadcrumbs={[
          { label: 'Sales', href: '/sales/quotes' },
          { label: 'Quotes', href: '/sales/quotes' },
          { label: editId ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => void saveQuote(false)}>
              <Save className="mr-1 h-4 w-4" />Save draft
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void saveQuote(true)}>
              <Send className="mr-1 h-4 w-4" />Send quote
            </Button>
            {editId && quoteStatus === 'ACCEPTED' && (
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => void convertToOrder()}>
                <ArrowRightCircle className="mr-1 h-4 w-4" />Convert to order
              </Button>
            )}
            {editId && ['SENT', 'VIEWED'].includes(quoteStatus) && (
              <Button size="sm" disabled={saving} onClick={() => void acceptQuote()}>
                <CheckCircle2 className="mr-1 h-4 w-4" />Accept quote
              </Button>
            )}
          </div>
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
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
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
                          {c.company && <span className="ml-2 text-slate-400">{c.company}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {contactId && deals.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Link deal (optional)</label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={dealId ?? ''}
                    onChange={(e) => setDealId(e.target.value || null)}
                  >
                    <option value="">No deal</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
              )}
              {contactId && deals.length === 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Link deal ID (optional)</label>
                  <Input
                    placeholder="Deal ID"
                    value={dealId ?? ''}
                    onChange={(e) => setDealId(e.target.value || null)}
                  />
                </div>
              )}

              <div className="relative">
                <label className="text-xs font-medium text-slate-500">Add product</label>
                <Input
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {products.length > 0 && productSearch && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {products.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            const idx = items.findIndex((i) => !i.productId)
                            addProductToLine(p, idx >= 0 ? idx : items.length)
                            if (idx < 0) setItems((prev) => [...prev, emptyLine()])
                          }}
                        >
                          {p.name}{' '}
                          <span className="text-slate-400">
                            ({p.sku}
                            {p.inventoryLevel != null && ` · stock ${p.inventoryLevel}`})
                          </span>
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
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 w-20">Qty</th>
                    <th className="px-3 py-2 w-24">Price</th>
                    <th className="px-3 py-2 w-20">Disc %</th>
                    <th className="px-3 py-2 w-20">Tax %</th>
                    <th className="px-3 py-2 w-24 text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const stockProduct = item.productId
                      ? products.find((p) => p.id === item.productId)
                      : null
                    return (
                    <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          className="h-8"
                        />
                        {item.productId && stockProduct?.inventoryLevel != null && (
                          <p
                            className={`mt-0.5 text-xs ${
                              stockProduct.inventoryLevel >= item.quantity
                                ? 'text-green-600'
                                : 'text-amber-600'
                            }`}
                          >
                            Stock: {stockProduct.inventoryLevel}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount}
                          onChange={(e) => updateLine(index, { discount: Number(e.target.value) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate}
                          onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ${item.lineTotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              <div className="p-3">
                <Button variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
                  <Plus className="mr-1 h-4 w-4" />Add row
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Notes</label>
                <textarea
                  className="mt-1 min-h-[60px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Terms & conditions</label>
                <textarea
                  className="mt-1 min-h-[60px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Valid until</label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardBody className="space-y-2 p-4">
            <h3 className="font-semibold">Totals</h3>
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span>Discount</span><span>-${totals.discountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span>Tax</span><span>${totals.taxTotal.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold dark:border-slate-700">
              <span>Grand total</span><span>${totals.total.toFixed(2)}</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
