import type { Metadata } from 'next'
import { Bell } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Alerts' }
export default function AlertsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Alerts" subtitle="System notifications, anomaly alerts, and action items" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Alerts' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Bell />} title="Alerts — Module 09" description="Notification centre with priority, categorisation, and actions." /></div>
    </div>
  )
}
