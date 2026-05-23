import type { Metadata } from 'next'
import { SlidersHorizontal } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'General Settings' }
export default function GeneralSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="General" subtitle="Workspace name, timezone, locale, and branding" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'General' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<SlidersHorizontal />} title="General Settings — Module 10" description="Workspace-level configuration and preferences." /></div>
    </div>
  )
}
