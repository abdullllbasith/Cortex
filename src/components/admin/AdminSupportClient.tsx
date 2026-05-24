'use client'

import useSWR from 'swr'
import { PageHeader, Card, CardBody, Badge } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'
import { formatDate } from '@/lib/admin/adminUi'

export function AdminSupportClient() {
  const { data, isLoading } = useSWR<{ tickets: Array<{
    id: string
    subject: string
    status: string
    priority: string
    createdAt: string
    tenant: { name: string }
  }> }>('/admin/support/tickets?limit=50', swrFetcher)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Support Tickets"
        subtitle="Customer support queue across all tenants"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Support' }]}
      />
      <div className="p-6">
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                ) : (
                  (data?.tickets ?? []).map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-4 py-3 font-medium">{t.subject}</td>
                      <td className="px-4 py-3 text-slate-500">{t.tenant.name}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{t.status}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="outline">{t.priority}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
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
