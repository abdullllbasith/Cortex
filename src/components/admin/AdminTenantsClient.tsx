'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import type { TenantPlan } from '@prisma/client'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Input,
  Badge,
  ConfirmDialog,
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  toast,
} from '@/components/ui'
import { DataTable, type ColumnDef } from '@/components/data/DataTable'
import { TenantActionsMenu } from '@/components/admin/TenantActionsMenu'
import { swrFetcher } from '@/lib/api/apiClient'
import { adminFetch } from '@/lib/admin/adminUi'
import {
  PLAN_BADGE,
  PLAN_LABELS,
  STATUS_BADGE,
  aiCallsPercent,
  storagePercent,
  formatCurrency,
  formatDate,
} from '@/lib/admin/adminUi'
import type { TenantListItem } from '@/lib/admin/tenantAdminService'

export function AdminTenantsClient() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TenantListItem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<TenantListItem | null>(null)
  const [planModal, setPlanModal] = useState<{ tenant: TenantListItem; plan: TenantPlan; note: string } | null>(null)
  const [bulkPlan, setBulkPlan] = useState<TenantPlan>('STARTER')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (plan) p.set('plan', plan)
    if (status) p.set('status', status)
    p.set('page', String(page))
    p.set('limit', '50')
    p.set('sort', 'createdAt')
    p.set('order', 'desc')
    return `/admin/tenants?${p.toString()}`
  }, [search, plan, status, page])

  const { data, mutate, isLoading } = useSWR<{
    items: TenantListItem[]
    total: number
    page: number
    limit: number
  }>(query, swrFetcher)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 50))

  const impersonate = useCallback(async (id: string) => {
    const res = await adminFetch<{ redirectUrl: string }>(`tenants/${id}/impersonate`, {
      method: 'POST',
    })
    if (res.success) {
      toast.success('Impersonation started')
      window.location.href = res.data?.redirectUrl ?? '/dashboard'
    } else toast.error(res.error?.message ?? 'Failed')
  }, [])

  const suspend = useCallback(
    async (tenant: TenantListItem, suspended: boolean) => {
      const reason = suspended
        ? prompt('Suspension reason:') ?? 'Admin action'
        : 'Reactivated by admin'
      const res = await adminFetch(`tenants/${tenant.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ suspended, reason }),
      })
      if (res.success) {
        toast.success(suspended ? 'Tenant suspended' : 'Tenant reactivated')
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    },
    [mutate],
  )

  const exportData = useCallback(async (id: string) => {
    const res = await adminFetch(`tenants/${id}/export`, { method: 'POST' })
    if (res.success) toast.success('Export queued')
    else toast.error(res.error?.message ?? 'Failed')
  }, [])

  const deleteTenant = useCallback(async () => {
    if (!deleteTarget) return
    const res = await adminFetch(`tenants/${deleteTarget.id}/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'DELETE' }),
    })
    if (res.success) {
      toast.success('Tenant deleted')
      setDeleteTarget(null)
      mutate()
    } else {
      toast.error(res.error?.message ?? 'Failed')
      throw new Error(res.error?.message)
    }
  }, [deleteTarget, mutate])

  const savePlan = useCallback(async () => {
    if (!planModal) return
    setLoading(true)
    try {
      const res = await adminFetch(`tenants/${planModal.tenant.id}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan: planModal.plan, note: planModal.note }),
      })
      if (res.success) {
        toast.success('Plan updated')
        setPlanModal(null)
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }, [planModal, mutate])

  const bulkChangePlan = useCallback(async () => {
    setLoading(true)
    try {
      for (const t of selected) {
        await adminFetch(`tenants/${t.id}/plan`, {
          method: 'PUT',
          body: JSON.stringify({ plan: bulkPlan, note: 'Bulk plan change' }),
        })
      }
      toast.success(`Updated ${selected.length} tenants`)
      setBulkOpen(false)
      setSelected([])
      mutate()
    } finally {
      setLoading(false)
    }
  }, [selected, bulkPlan, mutate])

  const bulkSuspend = useCallback(async () => {
    for (const t of selected) {
      await adminFetch(`tenants/${t.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ suspended: true, reason: 'Bulk suspension' }),
      })
    }
    toast.success(`Suspended ${selected.length} tenants`)
    setSelected([])
    mutate()
  }, [selected, mutate])

  const columns = useMemo<ColumnDef<TenantListItem>[]>(
    () => [
      {
        id: 'name',
        header: 'Tenant',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-slate-500">{row.slug}</p>
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => (
          <Badge variant={PLAN_BADGE[row.plan]}>{PLAN_LABELS[row.plan]}</Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.status]} className="capitalize">
            {row.status}
          </Badge>
        ),
      },
      {
        id: 'users',
        header: 'Users',
        accessorKey: 'userCount',
        type: 'number',
      },
      {
        id: 'mrr',
        header: 'MRR',
        cell: ({ row }) => formatCurrency(row.MRR),
      },
      {
        id: 'ai',
        header: 'AI Calls',
        cell: ({ row }) => {
          const pct = aiCallsPercent(row.plan, row.AICallsThisMonth)
          return (
            <div className="min-w-[80px]">
              <div className="mb-1 text-xs tabular-nums">{pct}%</div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        id: 'storage',
        header: 'Storage',
        cell: ({ row }) => {
          const pct = storagePercent(row.plan, row.storageUsedMB)
          return (
            <div className="min-w-[80px]">
              <div className="mb-1 text-xs tabular-nums">{pct}%</div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        id: 'joined',
        header: 'Joined',
        cell: ({ row }) => formatDate(row.createdAt),
      },
      {
        id: 'actions',
        header: '',
        type: 'actions',
        cell: ({ row }) => (
          <TenantActionsMenu
            actions={[
              { label: 'View', onClick: () => router.push(`/admin/tenants/${row.id}`) },
              { label: 'Impersonate', onClick: () => void impersonate(row.id) },
              {
                label: 'Change Plan',
                onClick: () =>
                  setPlanModal({ tenant: row, plan: row.plan, note: '' }),
              },
              {
                label: 'Override Quota',
                onClick: () => router.push(`/admin/tenants/${row.id}?panel=quota`),
              },
              {
                label: row.status === 'suspended' ? 'Unsuspend' : 'Suspend',
                onClick: () => void suspend(row, row.status !== 'suspended'),
              },
              { label: 'Export Data', onClick: () => void exportData(row.id) },
              {
                label: 'Delete',
                variant: 'danger',
                onClick: () => setDeleteTarget(row),
              },
            ]}
          />
        ),
      },
    ],
    [router, impersonate, suspend, exportData],
  )

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Tenants"
        subtitle={`${total} workspaces on the platform`}
        breadcrumbs={[{ label: 'Admin' }, { label: 'Tenants' }]}
      />

      <div className="space-y-4 p-6">
        <Card>
          <CardBody className="flex flex-wrap items-end gap-4 p-4">
            <div className="min-w-[200px] flex-1">
              <Input
                label="Search"
                placeholder="Name or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Plan</label>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All plans</option>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Status</label>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </CardBody>
        </Card>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 dark:border-indigo-900 dark:bg-indigo-950/30">
            <span className="text-sm">{selected.length} selected</span>
            <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
              Change plan
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void bulkSuspend()}>
              Suspend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push('/admin/announcements?bulk=1')}
            >
              Send announcement
            </Button>
          </div>
        )}

        <Card>
          <CardBody className="p-0">
            <DataTable
              columns={columns}
              data={items}
              loading={isLoading}
              keyField="id"
              selectable
              onSelectionChange={setSelected}
              onRowClick={(row) => router.push(`/admin/tenants/${row.id}`)}
              emptyTitle="No tenants found"
              emptyDescription="Try adjusting your filters."
            />
          </CardBody>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete tenant permanently?"
        description={`This will permanently delete "${deleteTarget?.name}" and all associated data. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteTenant}
      />

      <ModalRoot open={!!planModal} onOpenChange={(o) => !o && setPlanModal(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Change plan</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-sm text-slate-500">{planModal?.tenant.name}</p>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={planModal?.plan ?? 'STARTER'}
              onChange={(e) =>
                planModal &&
                setPlanModal({ ...planModal, plan: e.target.value as TenantPlan })
              }
            >
              <option value="STARTER">Starter</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Reason note (required)"
              rows={3}
              value={planModal?.note ?? ''}
              onChange={(e) =>
                planModal && setPlanModal({ ...planModal, note: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setPlanModal(null)}>
              Cancel
            </Button>
            <Button
              loading={loading}
              disabled={!planModal?.note.trim()}
              onClick={() => void savePlan()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>

      <ModalRoot open={bulkOpen} onOpenChange={setBulkOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Bulk change plan</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={bulkPlan}
              onChange={(e) => setBulkPlan(e.target.value as TenantPlan)}
            >
              <option value="STARTER">Starter</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => void bulkChangePlan()}>
              Apply to {selected.length} tenants
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalRoot>
    </div>
  )
}
