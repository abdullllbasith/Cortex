import type { Metadata } from 'next'
import { Cpu } from 'lucide-react'
import { PageHeader, EmptyState, Badge } from '@/components/ui'
export const metadata: Metadata = { title: 'Agent Detail' }
export default async function AgentTypePage({ params }: { params: Promise<{ agentType: string }> }) {
  const { agentType } = await params
  const label = agentType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <div className="flex flex-col h-full">
      <PageHeader title={label} subtitle={`Agent configuration and execution history`} breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents', href: '/agents' }, { label }]} actions={<Badge variant="info">Agent</Badge>} />
      <div className="flex-1 p-6"><EmptyState icon={<Cpu />} title={`${label} — Module 05`} description="Agent config, run history, logs, and performance metrics." /></div>
    </div>
  )
}
