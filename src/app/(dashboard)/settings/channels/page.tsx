import type { Metadata } from 'next'
import { Plug } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Channels' }
export default function ChannelsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Channels" subtitle="Communication and data integration channels" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Channels' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Plug />} title="Channels — Module 10" description="Connect Slack, email, WhatsApp, webhooks, and ERP systems." /></div>
    </div>
  )
}
