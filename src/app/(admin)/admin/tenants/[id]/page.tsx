import type { Metadata } from 'next'
import { Building2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'

export const metadata: Metadata = { title: 'Tenant Detail' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`Tenant Detail #${id}`}
        subtitle="Tenant configuration, usage, and billing status"
        breadcrumbs={[
          { label: 'Admin' },
          { label: 'Tenants', href: '/admin/tenants' },
          { label: id },
        ]}
      />
      <div className="flex-1 p-6">
        <EmptyState
          icon={<Building2 />}
          title="Tenant Detail — Module 11"
          description="Full admin detail view for this entity."
        />
      </div>
    </div>
  )
}
