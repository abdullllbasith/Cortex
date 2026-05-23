import type { Metadata } from 'next'
import { KeyRound } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'API Keys' }
export default function ApiKeysPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="API Keys" subtitle="Manage API credentials for SAIOS integrations" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'API Keys' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<KeyRound />} title="API Keys — Module 10" description="Generate, rotate, and revoke API keys with scope control." /></div>
    </div>
  )
}
