import type { Metadata } from 'next'
import { TrendingUp } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Sales Analytics' }
export default function SalesAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Sales Analytics" subtitle="Revenue, orders, conversion, and margin breakdown" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics', href: '/analytics' }, { label: 'Sales' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<TrendingUp />} title="Sales Analytics — Module 06" description="Revenue charts, cohort analysis, and AI-driven growth insights." /></div>
    </div>
  )
}
