import type { Metadata } from 'next'
import { PipelineKanbanClient } from '@/components/crm/PipelineKanbanClient'

export const metadata: Metadata = { title: 'CRM Pipeline' }

export default function CrmPipelinePage() {
  return <PipelineKanbanClient />
}
