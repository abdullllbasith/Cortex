'use client'

import { useState } from 'react'
import { Button, Input, Modal, toast } from '@/components/ui'
import { ApiError } from '@/lib/api/types'

export interface CustomerCreateFormValues {
  name: string
  email: string
  company: string
  tier: string
}

const EMPTY_FORM: CustomerCreateFormValues = {
  name: '',
  email: '',
  company: '',
  tier: '',
}

interface CustomerCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void | Promise<void>
  onSubmit: (values: CustomerCreateFormValues) => Promise<void>
}

export function CustomerCreateModal({
  open,
  onOpenChange,
  onCreated,
  onSubmit,
}: CustomerCreateModalProps) {
  const [form, setForm] = useState<CustomerCreateFormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function reset() {
    setForm(EMPTY_FORM)
  }

  function update(field: keyof CustomerCreateFormValues, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        tier: form.tier.trim(),
      })
      toast.success('Customer created. Active “New Customer” workflows will run automatically.')
      reset()
      onOpenChange(false)
      await onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="Add customer"
      description="Profile fields map to workflow variables like {{customer.name}} and {{customer.email}}."
      footer={(
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="customer-create-form" disabled={saving}>
            {saving ? 'Saving…' : 'Create customer'}
          </Button>
        </>
      )}
    >
      <form id="customer-create-form" onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Abdul Basith"
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="customer@example.com"
          required
        />
        <Input
          label="Company"
          value={form.company}
          onChange={(e) => update('company', e.target.value)}
          placeholder="Acme Corp"
        />
        <Input
          label="Tier"
          value={form.tier}
          onChange={(e) => update('tier', e.target.value)}
          placeholder="Gold, Silver, …"
        />
      </form>
    </Modal>
  )
}
