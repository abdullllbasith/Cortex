import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { InventoryAnalyticsContent } from './InventoryAnalyticsContent'

export const metadata: Metadata = { title: 'Inventory Analytics' }

export default function InventoryAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Inventory Analytics"
        subtitle="Stock levels, turnover rates, and reorder signals"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics', href: '/analytics' }, { label: 'Inventory' }]}
      />
      <InventoryAnalyticsContent />
    </div>
  )
}
