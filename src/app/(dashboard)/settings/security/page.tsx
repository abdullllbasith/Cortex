import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { SecurityMfaCard } from '@/components/settings/SecurityMfaCard'

export const metadata: Metadata = { title: 'Security' }

export default function SecuritySettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Security"
        subtitle="Two-factor authentication and session security"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings', href: '/settings/general' },
          { label: 'Security' },
        ]}
      />
      <ResponsiveContainer className="flex-1 space-y-6 py-6">
        <SecurityMfaCard />
      </ResponsiveContainer>
    </div>
  )
}
