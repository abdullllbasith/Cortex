import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Team' }
export default function TeamSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Team" subtitle="Members, invitations, and access control" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Team' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Users />} title="Team Management — Module 10" description="Invite members, manage roles, and review activity." /></div>
    </div>
  )
}
