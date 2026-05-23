import type { Metadata } from 'next'
import { Truck } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Suppliers' }
export default function SuppliersPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Suppliers" subtitle="Supplier profiles, contracts, and risk assessments" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Knowledge Base', href: '/knowledge' }, { label: 'Suppliers' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Truck />} title="Suppliers — Module 04" description="Supplier list with risk scores and lead-time analytics." /></div>
    </div>
  )
}
