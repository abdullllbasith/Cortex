'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import type { TenantPlan } from '@prisma/client'
import { UserCircle, Clock, Shield } from 'lucide-react'
import {
  PageHeader,
  Button,
  Card,
  CardBody,
  Badge,
  toast,
} from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { adminFetch } from '@/lib/admin/adminUi'
import {
  PLAN_BADGE,
  PLAN_LABELS,
  STATUS_BADGE,
  usagePercent,
  formatCurrency,
  formatDate,
} from '@/lib/admin/adminUi'
import { PLAN_LIMITS } from '@/lib/settings/billingService'
import type { TenantDetail } from '@/lib/admin/tenantAdminService'
import { formatLastActive } from '@/lib/settings/roleDefinitions'

interface AuditLog {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown>
  timestamp: string
  adminUser: { fullName: string; email: string }
}

function UsageMeter({
  label,
  used,
  limit,
  unit,
}: {
  label: string
  used: number
  limit: number
  unit?: string
}) {
  const pct = usagePercent(used, limit)
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <span className="text-xs text-slate-500">
          {used.toLocaleString()}
          {unit ?? ''} / {limit.toLocaleString()}
          {unit ?? ''}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{pct}% used</p>
    </div>
  )
}

export function AdminTenantDetailClient({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams()
  const showQuota = searchParams.get('panel') === 'quota'

  const { data: tenant, mutate, isLoading } = useSWR<TenantDetail>(
    `/admin/tenants/${tenantId}`,
    swrFetcher,
  )
  const { data: auditData } = useSWR<{ logs: AuditLog[] }>(
    `/admin/audit?tenantId=${tenantId}&limit=50`,
    swrFetcher,
  )

  const [plan, setPlan] = useState<TenantPlan | ''>('')
  const [planNote, setPlanNote] = useState('')
  const [quotas, setQuotas] = useState<Record<string, string>>({})
  const [quotaNote, setQuotaNote] = useState('')
  const [saving, setSaving] = useState(false)

  const impersonate = useCallback(async () => {
    const res = await adminFetch(`tenants/${tenantId}/impersonate`, { method: 'POST' })
    if (res.success) window.location.href = '/dashboard'
    else toast.error(res.error?.message ?? 'Failed')
  }, [tenantId])

  const savePlan = useCallback(async () => {
    if (!plan || !planNote.trim()) {
      toast.error('Select plan and add a reason')
      return
    }
    setSaving(true)
    try {
      const res = await adminFetch(`tenants/${tenantId}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan, note: planNote }),
      })
      if (res.success) {
        toast.success('Plan updated')
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }, [tenantId, plan, planNote, mutate])

  const saveQuotas = useCallback(async () => {
    setSaving(true)
    try {
      const payload: Record<string, number> = {}
      for (const [k, v] of Object.entries(quotas)) {
        if (v) payload[k] = Number(v)
      }
      const res = await adminFetch(`tenants/${tenantId}/quota`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (res.success) {
        toast.success('Quotas updated')
        mutate()
      } else toast.error(res.error?.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }, [tenantId, quotas, mutate])

  if (isLoading || !tenant) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Loading tenant…</p>
      </div>
    )
  }

  const limits = tenant.quotas
  const owner = tenant.users.find((u) => u.role === 'OWNER')

  return (
    <div className="flex flex-col">
      <PageHeader
        title={tenant.name}
        subtitle={tenant.slug}
        breadcrumbs={[
          { label: 'Admin' },
          { label: 'Tenants', href: '/admin/tenants' },
          { label: tenant.name },
        ]}
        actions={
          <Button onClick={() => void impersonate()}>Impersonate</Button>
        }
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardBody className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <UserCircle className="h-8 w-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-semibold">{tenant.name}</h2>
                  <Badge variant={PLAN_BADGE[tenant.plan]}>{PLAN_LABELS[tenant.plan]}</Badge>
                  <Badge variant={STATUS_BADGE[tenant.status]} className="capitalize">
                    {tenant.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Owner: {owner?.email ?? tenant.ownerEmail ?? '—'}
                </p>
                <p className="text-sm text-slate-500">
                  MRR: {formatCurrency(tenant.MRR)} · Joined {formatDate(tenant.createdAt)}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div>
          <h3 className="mb-3 font-display text-lg font-semibold">Usage</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageMeter
              label="AI Calls (month)"
              used={tenant.AICallsThisMonth}
              limit={limits.aiCalls}
            />
            <UsageMeter
              label="Team Members"
              used={tenant.usageHistory.teamMembers}
              limit={limits.teamMembers}
            />
            <UsageMeter
              label="Workflows"
              used={tenant.usageHistory.workflowsTotal}
              limit={limits.workflows}
            />
            <UsageMeter
              label="API Keys"
              used={tenant.usageHistory.apiKeysActive}
              limit={limits.apiCalls}
              unit=""
            />
            <UsageMeter
              label="Storage (MB)"
              used={tenant.storageUsedMB}
              limit={limits.storageGb * 1024}
            />
            <UsageMeter label="Users" used={tenant.userCount} limit={limits.teamMembers} />
          </div>
        </div>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-display text-lg font-semibold">Users</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="py-3 pr-4">{u.fullName}</td>
                      <td className="py-3 pr-4 text-slate-500">{u.email}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{u.role}</Badge>
                      </td>
                      <td className="py-3 text-slate-500">
                        {formatLastActive(u.lastLoginAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-display text-lg font-semibold">Subscription History</h3>
            <ul className="mt-4 space-y-4">
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-sm font-medium">Workspace created</p>
                  <p className="text-xs text-slate-500">{formatDate(tenant.createdAt)}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium">
                    Current plan: {PLAN_LABELS[tenant.plan]} ({formatCurrency(tenant.MRR)}/mo)
                  </p>
                  {tenant.admin.planOverrideNote && (
                    <p className="text-xs text-slate-500">{tenant.admin.planOverrideNote}</p>
                  )}
                </div>
              </li>
              {(tenant.admin.adminNotes ?? []).slice(-5).reverse().map((n, i) => (
                <li key={i} className="flex gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm">{n.note}</p>
                    <p className="text-xs text-slate-500">
                      {n.by} · {formatDate(n.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className={showQuota ? 'ring-2 ring-indigo-500' : undefined}>
          <CardBody className="space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Manual Overrides</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Plan override</p>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={plan || tenant.plan}
                  onChange={(e) => setPlan(e.target.value as TenantPlan)}
                >
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Reason note (required)"
                  rows={2}
                  value={planNote}
                  onChange={(e) => setPlanNote(e.target.value)}
                />
                <Button size="sm" loading={saving} onClick={() => void savePlan()}>
                  Apply plan
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Quota overrides</p>
                {(['aiCalls', 'workflows', 'storageGb', 'teamMembers'] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="w-28 text-xs text-slate-500">{key}</label>
                    <input
                      type="number"
                      placeholder={String(limits[key] ?? PLAN_LIMITS[tenant.plan][key])}
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={quotas[key] ?? ''}
                      onChange={(e) => setQuotas((q) => ({ ...q, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <Button size="sm" loading={saving} onClick={() => void saveQuotas()}>
                  Save quotas
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-display text-lg font-semibold">Admin Audit Trail</h3>
            <ul className="mt-4 space-y-2">
              {(auditData?.logs ?? []).map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    {log.action}
                  </span>
                  <span className="text-slate-500">
                    {log.adminUser.fullName} · {formatDate(log.timestamp)}
                  </span>
                </li>
              ))}
              {(auditData?.logs ?? []).length === 0 && (
                <li className="text-sm text-slate-500">No admin actions recorded yet.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
