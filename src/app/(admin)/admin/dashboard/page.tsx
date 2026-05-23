import type { Metadata } from 'next'
import { LayoutDashboard } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Admin Dashboard' }
export default function Page() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Admin Dashboard" subtitle="System-wide health, tenant overview, and platform metrics" breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<LayoutDashboard />} title="Admin Dashboard — Module 11" description="Admin panel — restricted to system administrators." /></div>
    </div>
  )
}
