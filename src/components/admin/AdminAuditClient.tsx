'use client'

import useSWR from 'swr'
import { PageHeader, Card, CardBody } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { formatDate } from '@/lib/admin/adminUi'

export function AdminAuditClient() {
  const { data, isLoading } = useSWR<{ logs: Array<{
    id: string
    action: string
    targetType: string | null
    targetId: string | null
    ipAddress: string | null
    timestamp: string
    adminUser: { fullName: string; email: string }
  }> }>('/admin/audit?limit=100', swrFetcher)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Audit Log"
        subtitle="All platform admin actions"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Audit Log' }]}
      />
      <div className="p-6">
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                ) : (
                  (data?.logs ?? []).map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                      <td className="px-4 py-3">{log.adminUser.fullName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {log.targetType ?? '—'} {log.targetId ? `#${log.targetId.slice(0, 8)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{log.ipAddress ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
