import type { Metadata } from 'next'
import { Activity } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Workflow Executions' }
export default async function WorkflowExecutionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Executions" subtitle={`Run history for workflow #${id}`} breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Workflows', href: '/workflows' }, { label: `#${id}` }, { label: 'Executions' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Activity />} title="Execution History — Module 08" description="Step-by-step run logs, timing, and error traces." /></div>
    </div>
  )
}
