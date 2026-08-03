'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { FeatureFlagScope, TenantPlan } from '@prisma/client'
import { Pencil, Plus } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  Toggle,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  Input,
  toast,
} from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { adminFetch } from '@/lib/admin/adminUi'

interface FeatureFlagRow {
  id: string
  key: string
  description: string | null
  enabledFor: FeatureFlagScope
  targetTenantIds: string[]
  targetPlans: TenantPlan[]
  isEnabled: boolean
  updatedAt: string
  updatedBy: { fullName: string; email: string } | null
}

export function AdminFeatureFlagsClient() {
  const { data: flags = [], mutate, isLoading } = useSWR<FeatureFlagRow[]>(
    '/admin/feature-flags',
    swrFetcher,
  )
  const [editFlag, setEditFlag] = useState<FeatureFlagRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    key: '',
    description: '',
    enabledFor: 'NONE' as FeatureFlagScope,
    targetPlans: [] as TenantPlan[],
    targetTenantIds: '',
    isEnabled: false,
  })
  const [loading, setLoading] = useState(false)

  async function toggleFlag(flag: FeatureFlagRow) {
    const res = await adminFetch('feature-flags', {
      method: 'PUT',
      body: JSON.stringify({ id: flag.id, isEnabled: !flag.isEnabled }),
    })
    if (res.success) mutate()
    else toast.error(res.error?.message ?? 'Failed')
  }

  async function saveFlag(isCreate: boolean) {
    setLoading(true)
    try {
      const payload = {
        ...(isCreate ? {} : { id: editFlag!.id }),
        key: form.key || editFlag?.key,
        description: form.description || undefined,
        enabledFor: form.enabledFor,
        targetPlans: form.targetPlans,
        targetTenantIds: form.targetTenantIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isEnabled: form.isEnabled,
      }
      const res = await adminFetch('feature-flags', {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      if (res.success) {
        toast.success(isCreate ? 'Flag created' : 'Flag updated')
        setEditFlag(null)
        setCreateOpen(false)
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(flag: FeatureFlagRow) {
    setEditFlag(flag)
    setForm({
      key: flag.key,
      description: flag.description ?? '',
      enabledFor: flag.enabledFor,
      targetPlans: flag.targetPlans,
      targetTenantIds: (flag.targetTenantIds as string[]).join(', '),
      isEnabled: flag.isEnabled,
    })
  }

  function FlagForm({ isCreate }: { isCreate: boolean }) {
    return (
      <div className="space-y-4">
        {isCreate && (
          <Input
            label="Key"
            placeholder="feature.new_dashboard"
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
          />
        )}
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div>
          <label className="mb-2 block text-sm font-medium">Targeting</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.enabledFor}
            onChange={(e) =>
              setForm((f) => ({ ...f, enabledFor: e.target.value as FeatureFlagScope }))
            }
          >
            <option value="NONE">None (disabled for all)</option>
            <option value="ALL">All tenants</option>
            <option value="SPECIFIC_PLANS">Specific plans</option>
            <option value="SPECIFIC_TENANTS">Specific tenant IDs</option>
          </select>
        </div>
        {form.enabledFor === 'SPECIFIC_PLANS' && (
          <div className="flex flex-wrap gap-2">
            {(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as TenantPlan[]).map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.targetPlans.includes(p)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      targetPlans: e.target.checked
                        ? [...f.targetPlans, p]
                        : f.targetPlans.filter((x) => x !== p),
                    }))
                  }
                />
                {p}
              </label>
            ))}
          </div>
        )}
        {form.enabledFor === 'SPECIFIC_TENANTS' && (
          <Input
            label="Tenant IDs (comma-separated)"
            value={form.targetTenantIds}
            onChange={(e) => setForm((f) => ({ ...f, targetTenantIds: e.target.value }))}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <Toggle
            checked={form.isEnabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
          />
          Enabled globally
        </label>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Feature Flags"
        subtitle="Control rollout of platform features"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Feature Flags' }]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New flag
          </Button>
        }
      />

      <div className="p-6">
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/50">
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Targets</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  flags.map((flag) => (
                    <tr key={flag.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-4 py-3 font-mono text-xs">{flag.key}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                        {flag.description ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Toggle
                          checked={flag.isEnabled}
                          onCheckedChange={() => void toggleFlag(flag)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{flag.enabledFor}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {flag.updatedBy?.fullName ?? '—'}
                        <br />
                        {new Date(flag.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(flag)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <ModalRoot open={!!editFlag} onOpenChange={(o) => !o && setEditFlag(null)}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Edit feature flag</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <FlagForm isCreate={false} />
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setEditFlag(null)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => void saveFlag(false)}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Create feature flag</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <FlagForm isCreate />
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => void saveFlag(true)}>
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
