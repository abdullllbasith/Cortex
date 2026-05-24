'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FileText, Download, Filter } from 'lucide-react'
import { PageHeader, Button, Card, CardBody, Badge, Input } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

interface AuditData {
  items: Array<{
    id: string
    action: string
    resourceType: string
    resourceId?: string
    severity: string
    timestamp: string
    user?: { fullName: string; email: string }
  }>
}

export function AuditPageClient() {
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    resourceType: '',
    severity: '',
    from: '',
    to: '',
  })

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString()

  const { data, isLoading } = useSWR<AuditData>(
    `/audit/logs?${query}`,
    swrFetcher,
  )

  async function exportCsv() {
    const res = await fetch('/api/audit/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: filters.from || undefined,
        to: filters.to || undefined,
        userId: filters.userId || undefined,
      }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const items = data?.items ?? []

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Audit Log"
        subtitle="Compliance timeline and security activity"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings' },
          { label: 'Audit' },
        ]}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <div id="privacy">
        <Card>
          <CardBody className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Data & Privacy</h2>
            <p className="mt-1 text-sm text-slate-500">
              Audit logs record who changed what in your workspace. Retention follows your plan policy.
              Contact your administrator for GDPR or data-deletion requests.
            </p>
          </CardBody>
        </Card>
        </div>

        <div id="export">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Export workspace data</h2>
              <p className="mt-1 text-sm text-slate-500">
                Download audit activity as CSV for compliance reviews.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardBody>
        </Card>
        </div>

        <Card>
          <CardBody className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Action" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} />
            <Input label="Resource type" value={filters.resourceType} onChange={(e) => setFilters((f) => ({ ...f, resourceType: e.target.value }))} />
            <Input label="Severity" value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))} placeholder="INFO | WARNING | CRITICAL" />
            <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </CardBody>
        </Card>

        <div className="relative space-y-0 border-l-2 border-slate-200 pl-6 dark:border-slate-800">
          {isLoading && <p className="text-sm text-slate-500">Loading audit events…</p>}
          {items.map((log: {
            id: string
            action: string
            resourceType: string
            resourceId?: string
            severity: string
            timestamp: string
            user?: { fullName: string; email: string }
          }) => (
            <div key={log.id} className="relative pb-6">
              <span className="absolute -left-[1.6rem] top-1 flex h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-950" />
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={log.severity === 'CRITICAL' ? 'danger' : log.severity === 'WARNING' ? 'warning' : 'default'}>
                    {log.severity}
                  </Badge>
                  <span className="font-medium">{log.action}</span>
                  <span className="text-xs text-slate-500">{log.resourceType}{log.resourceId ? ` · ${log.resourceId}` : ''}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(log.timestamp).toLocaleString()}
                  {log.user ? ` · ${log.user.fullName}` : ''}
                </p>
              </div>
            </div>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="h-4 w-4" />
              No audit events match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
