import type { Metadata } from 'next'
import { Package } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Inventory Analytics' }
export default function InventoryAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Inventory Analytics" subtitle="Stock levels, turnover rates, and reorder signals" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Analytics', href: '/analytics' }, { label: 'Inventory' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Package />} title="Inventory Analytics — Module 06" description="Stock health, slow movers, and demand forecasting." /></div>
    </div>
  )
}
