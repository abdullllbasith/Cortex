'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, Card, CardBody, Input, toast } from '@/components/ui'
import { apiClient } from '@/lib/api/apiClient'
import Link from 'next/link'
import { BarcodeField } from '@/components/inventory/BarcodeField'

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900'

export function ProductNewClient() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    costPrice: 0,
    sellingPrice: 0,
    reorderPoint: 10,
    reorderQuantity: 25,
    description: '',
  })

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required')
      return
    }
    setSubmitting(true)
    try {
      const product = await apiClient.post<{ id: string }>('/inventory/products', form)
      toast.success('Product created')
      router.push(`/inventory/products/${product.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Add Product"
        subtitle="Create a new catalogue item"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Products', href: '/inventory/products' },
          { label: 'New' },
        ]}
      />
      <div className="flex-1 p-6">
        <Card className="max-w-2xl">
          <CardBody className="p-6 space-y-4">
            <div>
              <BarcodeField
                value={form.barcode}
                onChange={(barcode) => setForm((f) => ({ ...f, barcode }))}
              />
            </div>
            {(
              [
                ['name', 'Name', 'text'],
                ['sku', 'SKU (optional)', 'text'],
                ['costPrice', 'Cost Price', 'number'],
                ['sellingPrice', 'Selling Price', 'number'],
                ['reorderPoint', 'Reorder Point', 'number'],
                ['reorderQuantity', 'Reorder Qty', 'number'],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key}>
                <label className="text-sm font-medium mb-1 block">{label}</label>
                <Input
                  type={type}
                  value={String(form[key])}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [key]: type === 'number' ? Number(e.target.value) : e.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <textarea
                className={`${selectClass} min-h-[100px] py-2`}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={submit} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Product'}
              </Button>
              <Link href="/inventory/products">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
