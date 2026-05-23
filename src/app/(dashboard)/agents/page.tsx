import type { Metadata } from 'next'
import { Cpu } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Agents' }
export default function AgentsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Agents" subtitle="Autonomous AI agents running scheduled and event-driven tasks" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Cpu />} title="Agents — Module 05" description="Configure, deploy, and monitor AI agents across your organisation." /></div>
    </div>
  )
}
