import type { Metadata } from 'next'
import { ClipboardList } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Audit Log' }
export default function AuditPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Audit Log" subtitle="Immutable record of all actions and changes" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Audit Log' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<ClipboardList />} title="Audit Log — Module 10" description="Searchable, filterable log of every user action and system event." /></div>
    </div>
  )
}
