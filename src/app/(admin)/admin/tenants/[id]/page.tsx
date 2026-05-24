import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AdminTenantDetailClient } from '@/components/admin/AdminTenantDetailClient'

export const metadata: Metadata = { title: 'Tenant Detail' }

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <AdminTenantDetailClient tenantId={id} />
    </Suspense>
  )
}
