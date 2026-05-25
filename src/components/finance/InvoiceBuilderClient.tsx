'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, Save, Send, FileText } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  toast,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
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
}

interface InvoiceDetail {
  id?: string
  contactId: string | null
  currency?: string
  items: SalesLineItem[]
  notes: string | null
  termsAndConditions: string | null
  issueDate: string
  dueDate: string
  contact?: { firstName: string; lastName: string } | null
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'PKR'] as const

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

function defaultDueDate(issue: string): string {
  const d = issue ? new Date(issue) : new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export function InvoiceBuilderClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')

  const [contactSearch, setContactSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState('')
  const [items, setItems] = useState<SalesLineItem[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Payment due within 30 days of invoice date.')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(defaultDueDate(new Date().toISOString().slice(0, 10)))
  const [saving, setSaving] = useState(false)

  const { data: existing } = useSWR<InvoiceDetail>(
    editId ? `/finance/invoices/${editId}` : null,
    swrFetcher,
  )

  const { data: taxData } = useSWR<{ items: Array<{ id: string; name: string; rate: number }> }>(
    '/finance/tax-rates',
    swrFetcher,
  )
  const taxRates = taxData?.items ?? []

  const { data: defaults } = useSWR<{ currency: string; termsAndConditions: string }>(
    !editId ? '/finance/invoices/defaults' : null,
    swrFetcher,
  )

  const { data: recentContactsRaw } = useSWR<{
    items: Array<{ id: string; firstName: string; lastName: string; email: string | null; company: string | null }>
  }>(!contactSearch && !contactId ? '/crm/contacts?limit=6' : null, swrFetcher)
  const recentContacts: ContactOption[] = (recentContactsRaw?.items ?? []).map((c) => ({
    id: c.id,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    company: c.company,
  }))

  useEffect(() => {
    if (!defaults || editId) return
    setCurrency(defaults.currency)
    setTerms(defaults.termsAndConditions)
  }, [defaults, editId])

  useEffect(() => {
    if (!existing) return
    setContactId(existing.contactId)
    setItems(existing.items?.length ? existing.items : [emptyLine()])
    setNotes(existing.notes ?? '')
    setTerms(existing.termsAndConditions ?? '')
    setIssueDate(existing.issueDate.slice(0, 10))
    setDueDate(existing.dueDate.slice(0, 10))
    if (existing.currency) setCurrency(existing.currency)
    if (existing.contact) {
      setSelectedContactLabel(`${existing.contact.firstName} ${existing.contact.lastName}`.trim())
    }
  }, [existing])

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

  const buildPayload = useCallback(
    () => ({
      contactId,
      items: totals.lines.map(({ productId, description, quantity, unitPrice, discount, taxRate, lineTotal }) => ({
        productId,
        description,
        quantity,
        unitPrice,
        discount,
        taxRate,
        lineTotal,
      })),
      notes,
      termsAndConditions: terms,
      currency,
      issueDate: new Date(issueDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
    }),
    [contactId, totals.lines, notes, terms, currency, issueDate, dueDate],
  )

  const saveInvoice = useCallback(
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
        const payload = buildPayload()
        let invoiceId = editId
        if (editId) {
          await apiClient.put(`/finance/invoices/${editId}`, payload)
        } else {
          const created = await apiClient.post<{ id: string }>('/finance/invoices', payload)
          invoiceId = created.id
        }
        if (sendAfter && invoiceId) {
          await apiClient.post(`/finance/invoices/${invoiceId}/send`)
          toast.success('Invoice saved and sent')
        } else {
          toast.success('Invoice saved')
        }
        router.push('/finance/invoices')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [contactId, items, buildPayload, editId, router],
  )

  const previewPdf = useCallback(async () => {
    if (!contactId) {
      toast.error('Select a contact first')
      return
    }
    setSaving(true)
    try {
      let invoiceId = editId
      if (!invoiceId) {
        const created = await apiClient.post<{ id: string }>('/finance/invoices', buildPayload())
        invoiceId = created.id
        router.replace(`/finance/invoices/new?id=${invoiceId}`)
      } else {
        await apiClient.put(`/finance/invoices/${invoiceId}`, buildPayload())
      }
      setPdfPreviewId(invoiceId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not preview PDF')
    } finally {
      setSaving(false)
    }
  }, [contactId, editId, buildPayload, router])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={editId ? 'Edit Invoice' : 'New Invoice'}
        subtitle="Create a customer invoice"
        breadcrumbs={[
          { label: 'Finance', href: '/finance/invoices' },
          { label: 'Invoices', href: '/finance/invoices' },
          { label: editId ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => void previewPdf()}>
              <FileText className="mr-1 h-4 w-4" />Preview PDF
            </Button>
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => void saveInvoice(false)}>
              <Save className="mr-1 h-4 w-4" />Save draft
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void saveInvoice(true)}>
              <Send className="mr-1 h-4 w-4" />Send invoice
            </Button>
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
                {!contactSearch && !contactId && recentContacts.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-1">Recent contacts</p>
                    <div className="flex flex-wrap gap-1">
                      {recentContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded-full border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            setContactId(c.id)
                            setSelectedContactLabel(c.fullName)
                          }}
                        >
                          {c.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Issue date</label>
                  <Input type="date" value={issueDate} onChange={(e) => {
                    setIssueDate(e.target.value)
                    if (!editId) setDueDate(defaultDueDate(e.target.value))
                  }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Due date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Currency</label>
                  <select
                    className="mt-0 w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative">
                <label className="text-xs font-medium text-slate-500">Add product</label>
                <Input placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
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
                    <th className="px-3 py-2 w-20">Disc %</th>
                    <th className="px-3 py-2 w-24">Tax</th>
                    <th className="px-3 py-2 w-24 text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-3 py-2"><Input value={item.description} onChange={(e) => updateLine(index, { description: e.target.value })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={1} value={item.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} max={100} value={item.discount} onChange={(e) => updateLine(index, { discount: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded border px-2 py-1.5 text-sm"
                          value={item.taxRate}
                          onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })}
                        >
                          <option value={item.taxRate}>{item.taxRate}%</option>
                          {taxRates.map((t) => (
                            <option key={t.id} value={t.rate}>{t.name} ({t.rate}%)</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.lineTotal.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} disabled={items.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
                  <Plus className="mr-1 h-4 w-4" />Add line
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Totals</h3>
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Discount</span><span>-{totals.discountTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Tax</span><span>{totals.taxTotal.toFixed(2)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3 p-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Notes</label>
                <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Payment terms</label>
                <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
            </CardBody>
          </Card>
          <Link href="/finance/invoices"><Button variant="ghost" size="sm" className="w-full">Cancel</Button></Link>
        </div>
      </div>

      <ModalRoot open={!!pdfPreviewId} onOpenChange={(open) => !open && setPdfPreviewId(null)}>
        <ModalContent size="xl">
          <ModalHeader>
            <ModalTitle>Invoice preview</ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody className="p-0">
            {pdfPreviewId && (
              <iframe
                title="Invoice PDF preview"
                src={`/api/finance/invoices/${pdfPreviewId}/pdf`}
                className="h-[70vh] w-full border-0"
              />
            )}
          </ModalBody>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
