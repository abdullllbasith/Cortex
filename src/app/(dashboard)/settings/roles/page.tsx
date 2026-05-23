import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Roles & Permissions' }
export default function RolesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Roles & Permissions" subtitle="Define roles and granular permission sets" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Roles' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<ShieldCheck />} title="RBAC — Module 10" description="Create custom roles with resource and action-level permissions." /></div>
    </div>
  )
}
