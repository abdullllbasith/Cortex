import type { Metadata } from 'next'
import { Building2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Tenants' }
export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tenants" subtitle="All registered tenants and workspace management" breadcrumbs={[{ label: 'Admin' }, { label: 'Tenants' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Building2 />} title="Tenants — Module 11" description="Admin panel — restricted to system administrators." /></div>
    </div>
  )
}
