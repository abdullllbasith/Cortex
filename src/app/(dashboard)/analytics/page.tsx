import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Analytics' }
export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Analytics" subtitle="Enterprise performance metrics and trend analysis" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<BarChart3 />} title="Analytics — Module 06" description="Sales, inventory, customer, and supplier analytics with Recharts." /></div>
    </div>
  )
}
