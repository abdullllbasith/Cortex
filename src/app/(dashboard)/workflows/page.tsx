import type { Metadata } from 'next'
import { GitBranch } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Workflows' }
export default function WorkflowsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Workflows" subtitle="Automated business process orchestration" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Workflows' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<GitBranch />} title="Workflows — Module 08" description="Visual workflow builder with triggers, conditions, and AI steps." /></div>
    </div>
  )
}
