import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Settings' }
export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" subtitle="Manage your workspace, team, and integrations" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Settings />} title="Settings — Module 10" description="Workspace preferences, team management, and integration config." /></div>
    </div>
  )
}
