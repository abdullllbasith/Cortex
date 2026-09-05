'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { PageHeader, Button, Card, CardBody, Input, toast } from '@/components/ui'
import { authFetch } from '@/lib/api/apiClient'

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

const STEPS = ['Basic Info', 'Contact & Address', 'Financial', 'Review']

export function SupplierNewClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'DISTRIBUTOR',
    contactName: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    paymentTerms: 'NET30',
    currency: 'USD',
    taxNumber: '',
    creditLimit: '',
    bankName: '',
    accountNumber: '',
    notes: '',
    isActive: true,
  })

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  async function submit() {
    setSaving(true)
    try {
      const res = await authFetch('/api/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          contactName: form.contactName || null,
          email: form.email || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          website: form.website || null,
          address: {
            line1: form.line1,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          },
          paymentTerms: form.paymentTerms,
          currency: form.currency,
          taxNumber: form.taxNumber || null,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
          bankDetails: form.bankName || form.accountNumber
            ? { bankName: form.bankName, accountNumber: form.accountNumber }
            : null,
          notes: form.notes || null,
          isActive: form.isActive,
          contacts: form.contactName
            ? [{ name: form.contactName, email: form.email || null, phone: form.phone || null, isPrimary: true }]
            : [],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create supplier')
      toast.success('Supplier created')
      router.push(`/inventory/suppliers/${json.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6">
      <PageHeader
        title="Add Supplier"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Suppliers', href: '/inventory/suppliers' },
          { label: 'New' },
        ]}
        actions={
          <Link href="/inventory/suppliers">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          </Link>
        }
      />

      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
              i === step ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
              i < step ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            {i < step ? <Check className="h-4 w-4" /> : <span className="font-mono text-xs">{i + 1}</span>}
            {label}
          </div>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 max-w-2xl">
          {step === 0 && (
            <>
              <Input label="Supplier Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
              <label className="text-sm font-medium">Type
                <select className={`${selectClass} mt-1`} value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                Active supplier
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <Input label="Primary Contact" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                <Input label="Mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
              </div>
              <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} />
              <Input label="Address Line 1" value={form.line1} onChange={(e) => set('line1', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
                <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Postal Code" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
                <Input label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="text-sm font-medium">Payment Terms
                <select className={`${selectClass} mt-1`} value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)}>
                  <option value="IMMEDIATE">Immediate</option>
                  <option value="NET15">Net 15</option>
                  <option value="NET30">Net 30</option>
                  <option value="NET45">Net 45</option>
                  <option value="NET60">Net 60</option>
                </select>
              </label>
              <Input label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} />
              <Input label="Tax Number" value={form.taxNumber} onChange={(e) => set('taxNumber', e.target.value)} />
              <Input label="Credit Limit" type="number" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} />
              <Input label="Bank Name" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
              <Input label="Account Number" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
              <p className="text-xs text-slate-500">Bank details are encrypted at rest.</p>
            </>
          )}

          {step === 3 && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{form.name}</dd></div>
              <div><dt className="text-slate-500">Type</dt><dd>{form.type.replace('_', ' ')}</dd></div>
              <div><dt className="text-slate-500">Contact</dt><dd>{form.contactName || '—'}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd>{form.email || '—'}</dd></div>
              <div><dt className="text-slate-500">Payment Terms</dt><dd>{form.paymentTerms.replace('NET', 'Net ')}</dd></div>
              <div><dt className="text-slate-500">Currency</dt><dd>{form.currency}</dd></div>
            </dl>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={step === 0 && !form.name.trim()} onClick={() => setStep((s) => s + 1)}>
                Next<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={saving || !form.name.trim()} onClick={() => void submit()}>
                {saving ? 'Creating…' : 'Create Supplier'}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
