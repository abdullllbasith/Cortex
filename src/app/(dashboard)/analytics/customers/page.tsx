import type { Metadata } from 'next'
import { Users2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Customer Analytics' }
export default function CustomerAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Customer Analytics" subtitle="Churn, LTV, segmentation, and acquisition trends" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics', href: '/analytics' }, { label: 'Customers' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Users2 />} title="Customer Analytics — Module 06" description="Churn prediction, LTV segmentation, and acquisition funnel." /></div>
    </div>
  )
}
