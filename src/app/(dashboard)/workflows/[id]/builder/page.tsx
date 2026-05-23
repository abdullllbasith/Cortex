import type { Metadata } from 'next'
import { GitBranch } from 'lucide-react'
import { PageHeader, EmptyState, Badge } from '@/components/ui'
export const metadata: Metadata = { title: 'Workflow Builder' }
export default async function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Workflow Builder" subtitle={`Editing workflow #${id}`} breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Workflows', href: '/workflows' }, { label: `#${id}`, href: `/workflows/${id}/executions` }, { label: 'Builder' }]} actions={<Badge variant="warning">Draft</Badge>} />
      <div className="flex-1 p-6"><EmptyState icon={<GitBranch />} title="Visual Builder — Module 08" description="Drag-and-drop node editor with AI step suggestions." /></div>
    </div>
  )
}
