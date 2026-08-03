import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { SalesAnalyticsContent } from './SalesAnalyticsContent'

export const metadata: Metadata = { title: 'Sales Analytics' }

export default function SalesAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Sales Analytics"
        subtitle="Revenue, orders, conversion, and margin breakdown"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics', href: '/analytics' }, { label: 'Sales' }]}
      />
      <SalesAnalyticsContent />
    </div>
  )
}
