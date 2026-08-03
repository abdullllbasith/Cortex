import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { CustomersAnalyticsContent } from './CustomersAnalyticsContent'

export const metadata: Metadata = { title: 'Customer Analytics' }

export default function CustomerAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Customer Analytics"
        subtitle="Churn, LTV, segmentation, and acquisition trends"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics', href: '/analytics' }, { label: 'Customers' }]}
      />
      <CustomersAnalyticsContent />
    </div>
  )
}
