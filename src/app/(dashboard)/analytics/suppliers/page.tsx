import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { SuppliersAnalyticsContent } from './SuppliersAnalyticsContent'

export const metadata: Metadata = { title: 'Supplier Analytics' }

export default function SupplierAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Supplier Analytics"
        subtitle="Lead times, quality scores, and dependency risk"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics', href: '/analytics' }, { label: 'Suppliers' }]}
      />
      <SuppliersAnalyticsContent />
    </div>
  )
}
