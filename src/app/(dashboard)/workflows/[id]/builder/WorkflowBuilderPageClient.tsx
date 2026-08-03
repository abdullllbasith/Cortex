'use client'

import { PageHeader } from '@/components/ui'
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer'
import { LazyWorkflowBuilder } from '@/lib/lazy/components'

export default function WorkflowBuilderPageClient({ id }: { id: string }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Workflow Builder"
        subtitle="Visual automation designer"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Workflows', href: '/workflows' },
          { label: 'Builder' },
        ]}
      />
      <ResponsiveContainer className="flex-1 py-4">
        <LazyWorkflowBuilder workflowId={id} />
      </ResponsiveContainer>
    </div>
  )
}
