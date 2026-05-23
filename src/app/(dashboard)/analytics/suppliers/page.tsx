import type { Metadata } from 'next'
import { Truck } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Supplier Analytics' }
export default function SupplierAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Supplier Analytics" subtitle="Lead times, quality scores, and dependency risk" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics', href: '/analytics' }, { label: 'Suppliers' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Truck />} title="Supplier Analytics — Module 06" description="Supplier performance, lead-time variance, and risk exposure." /></div>
    </div>
  )
}
