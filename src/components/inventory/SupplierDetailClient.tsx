'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ArrowLeft, Plus, Save, Trash2, Mail, Upload, Lock, Download } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { swrFetcher, authFetch } from '@/lib/api/apiClient'

type Tab = 'profile' | 'products' | 'orders' | 'performance' | 'contacts'

interface BankMasked {
  bankName?: string | null
  accountName?: string | null
  accountLast4?: string
  routingNumber?: string | null
  swiftCode?: string | null
}

interface SupplierDetail {
  id: string
  code: string
  name: string
  type: string
  contactName: string
  email: string
  phone: string | null
  mobile: string | null
  website: string | null
  address: Record<string, string>
  paymentTerms: string
  currency: string
  taxNumber: string | null
  creditLimit: number | null
  isActive: boolean
  notes: string | null
  rating: number | null
  performanceScore: number
  version: number
  bankDetailsMasked?: BankMasked | null
  bankDetails?: Record<string, string> | null
}

interface SupplierProduct extends Record<string, unknown> {
  id: string
  productId: string
  supplierSku: string | null
  unitCost: number
  minOrderQty: number
  leadTimeDays: number
  isPreferred: boolean
  lastPriceDate: string | null
  product: { id: string; sku: string; name: string }
}

interface POItem extends Record<string, unknown> {
  id: string
  poNumber: string
  status: string
  grandTotal: number
  currency: string
  expectedDelivery: string | null
  createdAt: string
  warehouse: { name: string; code: string }
}

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  designation: string | null
  isPrimary: boolean
  isActive: boolean
}

interface Performance {
  currentScore: number
  onTimeRate: number
  costAccuracy: number
  qualityScore: number
  rating: number
  avgDeliveryDays: number
  costVariance: number
  onTimeTrend: Array<{ month: string; onTimeRate: number }>
  delayTrend: Array<{ month: string; avgDelayDays: number }>
  costVarianceByPo: Array<{
    poId: string
    poNumber: string
    orderedCost: number
    actualCost: number
    variancePct: number
  }>
  reliabilityTrend: Array<{ month: string; score: number }>
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Purchase Orders' },
  { id: 'performance', label: 'Performance' },
  { id: 'contacts', label: 'Contacts' },
]

const PRICE_CSV_TEMPLATE = `productId,unitCost
`

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const priceFileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('profile')
  const [form, setForm] = useState<Partial<SupplierDetail>>({})
  const [bankForm, setBankForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [bankUnlocked, setBankUnlocked] = useState(false)
  const [poStatus, setPoStatus] = useState('')
  const [poFrom, setPoFrom] = useState('')
  const [poTo, setPoTo] = useState('')
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', designation: '' })
  const [productForm, setProductForm] = useState({ productId: '', unitCost: '', leadTimeDays: '7', minOrderQty: '1', supplierSku: '' })
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null)
  const [bulkImporting, setBulkImporting] = useState(false)

  const { data: supplier, mutate, isLoading, error } = useSWR<SupplierDetail>(
    `/inventory/suppliers/${supplierId}`,
    swrFetcher,
  )

  const { data: products = [], mutate: mutateProducts } = useSWR<SupplierProduct[]>(
    tab === 'products' ? `/inventory/suppliers/${supplierId}/products` : null,
    swrFetcher,
  )

  const poQuery = useMemo(() => {
    const p = new URLSearchParams({ supplierId, limit: '50' })
    if (poStatus) p.set('status', poStatus)
    if (poFrom) p.set('dateFrom', poFrom)
    if (poTo) p.set('dateTo', poTo)
    return `/inventory/purchase-orders?${p}`
  }, [supplierId, poStatus, poFrom, poTo])

  const { data: poData } = useSWR<{ items: POItem[] }>(
    tab === 'orders' ? poQuery : null,
    swrFetcher,
  )

  const { data: performance } = useSWR<Performance>(
    tab === 'performance' ? `/inventory/suppliers/${supplierId}/performance` : null,
    swrFetcher,
  )

  const { data: contacts = [], mutate: mutateContacts } = useSWR<Contact[]>(
    tab === 'contacts' ? `/inventory/suppliers/${supplierId}/contacts` : null,
    swrFetcher,
  )

  const { data: catalogData } = useSWR<{
    data?: Array<{ id: string; name: string; sku: string }>
  } | Array<{ id: string; name: string; sku: string }>>(
    tab === 'products' ? '/inventory/products?limit=100' : null,
    swrFetcher,
  )
  const catalogProducts = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.data ?? [])

  const current = { ...supplier, ...form } as SupplierDetail
  const maskedBank = supplier?.bankDetailsMasked
  const displayBank = bankUnlocked && supplier?.bankDetails ? supplier.bankDetails : null

  const unlockBankDetails = useCallback(async () => {
    if (!unlockPassword.trim()) return
    try {
      const params = new URLSearchParams({ unlockPassword })
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Unlock failed')
      if (json.data.bankDetails) {
        setBankUnlocked(true)
        setBankForm(json.data.bankDetails as Record<string, string>)
        mutate({ ...supplier!, bankDetails: json.data.bankDetails }, false)
        toast.success('Bank details unlocked')
        setUnlockOpen(false)
        setUnlockPassword('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid password')
    }
  }, [unlockPassword, supplierId, supplier, mutate])

  async function saveProfile() {
    if (!supplier) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: current.name,
          type: current.type,
          contactName: current.contactName,
          email: current.email,
          phone: current.phone,
          mobile: current.mobile,
          website: current.website,
          address: current.address,
          paymentTerms: current.paymentTerms,
          currency: current.currency,
          taxNumber: current.taxNumber,
          creditLimit: current.creditLimit,
          isActive: current.isActive,
          notes: current.notes,
          ...(Object.keys(bankForm).length > 0 && bankUnlocked ? { bankDetails: bankForm } : {}),
          version: supplier.version,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Save failed')
      toast.success('Supplier updated')
      setForm({})
      setBankUnlocked(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function addProduct() {
    if (!productForm.productId || !productForm.unitCost) return
    try {
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productForm.productId,
          supplierSku: productForm.supplierSku || null,
          unitCost: Number(productForm.unitCost),
          leadTimeDays: Number(productForm.leadTimeDays),
          minOrderQty: Number(productForm.minOrderQty),
          // Preferred so Reorder Centre can group this product under this supplier
          isPreferred: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      toast.success('Product linked')
      setProductForm({ productId: '', unitCost: '', leadTimeDays: '7', minOrderQty: '1', supplierSku: '' })
      mutateProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function saveProductEdit() {
    if (!editingProduct) return
    try {
      const res = await authFetch(
        `/api/inventory/suppliers/${supplierId}/products?linkId=${editingProduct.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierSku: editingProduct.supplierSku,
            unitCost: editingProduct.unitCost,
            minOrderQty: editingProduct.minOrderQty,
            leadTimeDays: editingProduct.leadTimeDays,
            isPreferred: editingProduct.isPreferred,
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      toast.success('Product pricing updated')
      setEditingProduct(null)
      mutateProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function togglePreferred(row: SupplierProduct) {
    try {
      const res = await authFetch(
        `/api/inventory/suppliers/${supplierId}/products?linkId=${row.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPreferred: !row.isPreferred }),
        },
      )
      if (!res.ok) throw new Error('Update failed')
      mutateProducts()
    } catch {
      toast.error('Failed to update preferred flag')
    }
  }

  async function handleBulkPriceCsv(file: File) {
    setBulkImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}/products`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Import failed')
      toast.success(`Updated ${json.data.updated} price(s)`)
      mutateProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBulkImporting(false)
    }
  }

  async function addContact() {
    if (!newContact.name.trim()) return
    try {
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newContact, isPrimary: contacts.length === 0 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      toast.success('Contact added')
      setNewContact({ name: '', email: '', phone: '', designation: '' })
      mutateContacts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function removeContact(contactId: string) {
    try {
      const res = await authFetch(`/api/inventory/suppliers/${supplierId}/contacts?contactId=${contactId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Contact removed')
      mutateContacts()
    } catch {
      toast.error('Failed to remove contact')
    }
  }

  function openEmailCompose(contact: Contact) {
    const to = contact.email ?? supplier?.email ?? ''
    if (!to) {
      toast.error('No email address for this contact')
      return
    }
    const subject = encodeURIComponent(`Regarding ${supplier?.name ?? 'supplier'}`)
    const body = encodeURIComponent(`Hi ${contact.name},\n\n`)
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  const productColumns: ColumnDef<SupplierProduct>[] = [
    { id: 'name', header: 'Product', cell: ({ row }) => row.product.name },
    { id: 'supplierSku', header: 'Supplier SKU', accessorKey: 'supplierSku' },
    { id: 'unitCost', header: 'Unit Cost', type: 'currency', cell: ({ row }) => row.unitCost },
    { id: 'minOrderQty', header: 'MOQ', accessorKey: 'minOrderQty' },
    { id: 'leadTimeDays', header: 'Lead Time', cell: ({ row }) => `${row.leadTimeDays}d` },
    {
      id: 'preferred',
      header: 'Preferred',
      cell: ({ row }) => (
        <button
          type="button"
          className={`rounded px-2 py-0.5 text-xs ${row.isPreferred ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
          onClick={() => void togglePreferred(row)}
        >
          {row.isPreferred ? 'Yes' : 'No'}
        </button>
      ),
    },
    {
      id: 'lastPrice',
      header: 'Last Price Date',
      cell: ({ row }) => (row.lastPriceDate ? new Date(row.lastPriceDate).toLocaleDateString() : '—'),
    },
    {
      id: 'edit',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline"
          onClick={() => setEditingProduct({ ...row })}
        >
          Edit
        </button>
      ),
    },
  ]

  const poColumns: ColumnDef<POItem>[] = [
    {
      id: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <Link href={`/inventory/purchase-orders/${row.id}`} className="text-indigo-600 hover:underline">
          {row.poNumber}
        </Link>
      ),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge>{row.status}</Badge> },
    { id: 'total', header: 'Amount', type: 'currency', cell: ({ row }) => row.grandTotal },
    { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => row.warehouse.name },
    {
      id: 'expected',
      header: 'Expected Delivery',
      cell: ({ row }) =>
        row.expectedDelivery ? new Date(row.expectedDelivery).toLocaleDateString() : '—',
    },
    {
      id: 'created',
      header: 'Created',
      cell: ({ row }) => new Date(row.createdAt).toLocaleDateString(),
    },
  ]

  if (isLoading) return <div className="p-6 text-slate-500">Loading supplier…</div>
  if (error || !supplier) return <div className="p-6 text-red-500">Supplier not found</div>

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6">
      <PageHeader
        title={supplier.name}
        subtitle={`${supplier.code} · ${supplier.type.replace('_', ' ')} · ${supplier.performanceScore}% reliability`}
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Suppliers', href: '/inventory/suppliers' },
          { label: supplier.name },
        ]}
        actions={
          <Link href="/inventory/suppliers">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
              <p className="md:col-span-2 text-sm font-semibold text-slate-700 dark:text-slate-300">General</p>
              <Input label="Name" value={current.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <label className="text-sm font-medium">Type
                <select
                  className={`${selectClass} mt-1`}
                  value={current.type ?? 'DISTRIBUTOR'}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                </select>
              </label>
              <Input label="Contact Name" value={current.contactName ?? ''} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
              <Input label="Email" value={current.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="Phone" value={current.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <Input label="Mobile" value={current.mobile ?? ''} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
              <Input label="Website" value={current.website ?? ''} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              <label className="text-sm font-medium">Payment Terms
                <select
                  className={`${selectClass} mt-1`}
                  value={current.paymentTerms ?? 'NET30'}
                  onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                >
                  <option value="IMMEDIATE">Immediate</option>
                  <option value="NET15">Net 15</option>
                  <option value="NET30">Net 30</option>
                  <option value="NET45">Net 45</option>
                  <option value="NET60">Net 60</option>
                </select>
              </label>
              <Input label="Currency" value={current.currency ?? 'USD'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              <Input label="Tax Number" value={current.taxNumber ?? ''} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))} />
              <Input label="Credit Limit" type="number" value={current.creditLimit ?? ''} onChange={(e) => setForm((f) => ({ ...f, creditLimit: Number(e.target.value) }))} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={current.isActive ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active supplier
              </label>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Notes
                  <textarea
                    className={`${selectClass} mt-1 min-h-[80px]`}
                    value={current.notes ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </label>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bank Details (encrypted)</p>
                {!bankUnlocked && (
                  <Button variant="outline" size="sm" onClick={() => setUnlockOpen(true)}>
                    <Lock className="mr-2 h-3.5 w-3.5" />Unlock to edit
                  </Button>
                )}
              </div>
              {bankUnlocked && displayBank ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input label="Bank Name" value={bankForm.bankName ?? ''} onChange={(e) => setBankForm((b) => ({ ...b, bankName: e.target.value }))} />
                  <Input label="Account Name" value={bankForm.accountName ?? ''} onChange={(e) => setBankForm((b) => ({ ...b, accountName: e.target.value }))} />
                  <Input label="Account Number" value={bankForm.accountNumber ?? ''} onChange={(e) => setBankForm((b) => ({ ...b, accountNumber: e.target.value }))} />
                  <Input label="Routing Number" value={bankForm.routingNumber ?? ''} onChange={(e) => setBankForm((b) => ({ ...b, routingNumber: e.target.value }))} />
                  <Input label="SWIFT" value={bankForm.swiftCode ?? ''} onChange={(e) => setBankForm((b) => ({ ...b, swiftCode: e.target.value }))} />
                </div>
              ) : maskedBank ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
                  <p>Bank: {maskedBank.bankName ?? '—'}</p>
                  <p>Account: ****{maskedBank.accountLast4 ?? '****'}</p>
                  {maskedBank.routingNumber && <p>Routing: {maskedBank.routingNumber}</p>}
                  {maskedBank.swiftCode && <p>SWIFT: {maskedBank.swiftCode}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No bank details on file</p>
              )}
            </CardBody>
          </Card>

          {unlockOpen && (
            <Card>
              <CardBody className="flex max-w-md flex-col gap-3">
                <p className="text-sm text-slate-600">Confirm your password to view and edit bank details.</p>
                <Input
                  type="password"
                  label="Password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={() => void unlockBankDetails()}>Confirm</Button>
                  <Button variant="outline" onClick={() => { setUnlockOpen(false); setUnlockPassword('') }}>Cancel</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={() => void saveProfile()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <select className={selectClass} value={productForm.productId} onChange={(e) => setProductForm((f) => ({ ...f, productId: e.target.value }))}>
                <option value="">Select product…</option>
                {catalogProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
              <Input placeholder="Supplier SKU" value={productForm.supplierSku} onChange={(e) => setProductForm((f) => ({ ...f, supplierSku: e.target.value }))} />
              <Input placeholder="Unit cost" type="number" value={productForm.unitCost} onChange={(e) => setProductForm((f) => ({ ...f, unitCost: e.target.value }))} />
              <Input placeholder="Lead time (days)" type="number" value={productForm.leadTimeDays} onChange={(e) => setProductForm((f) => ({ ...f, leadTimeDays: e.target.value }))} />
              <Input placeholder="Min order qty" type="number" value={productForm.minOrderQty} onChange={(e) => setProductForm((f) => ({ ...f, minOrderQty: e.target.value }))} />
              <Button onClick={() => void addProduct()}><Plus className="mr-2 h-4 w-4" />Add Product</Button>
            </CardBody>
          </Card>
          <div className="flex flex-wrap gap-2">
            <input
              ref={priceFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleBulkPriceCsv(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([PRICE_CSV_TEMPLATE], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'supplier-prices-template.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="mr-2 h-4 w-4" />Price template
            </Button>
            <Button variant="outline" size="sm" disabled={bulkImporting} onClick={() => priceFileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Bulk update prices
            </Button>
          </div>
          <DataTable columns={productColumns} data={products} />
          {editingProduct && (
            <Card>
              <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <p className="md:col-span-4 text-sm font-medium">Edit: {editingProduct.product.name}</p>
                <Input label="Supplier SKU" value={editingProduct.supplierSku ?? ''} onChange={(e) => setEditingProduct((p) => p && { ...p, supplierSku: e.target.value })} />
                <Input label="Unit Cost" type="number" value={editingProduct.unitCost} onChange={(e) => setEditingProduct((p) => p && { ...p, unitCost: Number(e.target.value) })} />
                <Input label="MOQ" type="number" value={editingProduct.minOrderQty} onChange={(e) => setEditingProduct((p) => p && { ...p, minOrderQty: Number(e.target.value) })} />
                <Input label="Lead Time" type="number" value={editingProduct.leadTimeDays} onChange={(e) => setEditingProduct((p) => p && { ...p, leadTimeDays: Number(e.target.value) })} />
                <div className="flex gap-2 md:col-span-4">
                  <Button onClick={() => void saveProductEdit()}>Save</Button>
                  <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <select className={`${selectClass} max-w-xs`} value={poStatus} onChange={(e) => setPoStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="PARTIAL">Partial</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Input type="date" label="From" value={poFrom} onChange={(e) => setPoFrom(e.target.value)} className="max-w-[180px]" />
            <Input type="date" label="To" value={poTo} onChange={(e) => setPoTo(e.target.value)} className="max-w-[180px]" />
          </div>
          <DataTable columns={poColumns} data={poData?.items ?? []} />
        </div>
      )}

      {tab === 'performance' && performance && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card><CardBody className="p-4"><p className="text-xs text-slate-500">Reliability Score</p><p className="text-3xl font-semibold">{performance.currentScore}%</p><p className="mt-1 text-xs text-slate-400">50% on-time · 30% cost · 20% quality</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-slate-500">On-Time Rate</p><p className="text-3xl font-semibold">{performance.onTimeRate}%</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-slate-500">Avg Delay (days)</p><p className="text-3xl font-semibold">{performance.avgDeliveryDays}</p></CardBody></Card>
            <Card><CardBody className="p-4"><p className="text-xs text-slate-500">Cost Variance</p><p className="text-3xl font-semibold">{performance.costVariance}%</p></CardBody></Card>
          </div>
          <Card>
            <CardBody>
              <p className="mb-3 text-sm font-medium">On-Time Delivery Rate (12 months)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={performance.onTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, 'On-time']} />
                  <Bar dataKey="onTimeRate" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <p className="mb-3 text-sm font-medium">Average Delay Days (trend)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={performance.delayTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgDelayDays" stroke="#dc2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="mb-3 text-sm font-medium">Cost Variance by PO</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={performance.costVarianceByPo.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="poNumber" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orderedCost" fill="#94a3b8" name="Ordered" />
                    <Bar dataKey="actualCost" fill="#4f46e5" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Input placeholder="Name *" value={newContact.name} onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))} />
              <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))} />
              <Input placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))} />
              <Input placeholder="Designation" value={newContact.designation} onChange={(e) => setNewContact((c) => ({ ...c, designation: e.target.value }))} />
              <Button onClick={() => void addContact()}><Plus className="mr-2 h-4 w-4" />Add Contact</Button>
            </CardBody>
          </Card>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Designation</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      {c.name}
                      {c.isPrimary && <Badge className="ml-2">Primary</Badge>}
                    </td>
                    <td className="px-4 py-2">{c.designation ?? '—'}</td>
                    <td className="px-4 py-2">{c.email ?? '—'}</td>
                    <td className="px-4 py-2">{c.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEmailCompose(c)}>
                          <Mail className="mr-1 h-3.5 w-3.5" />Send email
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void removeContact(c.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!contacts.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No contacts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
