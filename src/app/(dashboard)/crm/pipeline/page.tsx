import type { Metadata } from 'next'
import { PipelineKanbanClient } from '@/components/crm/PipelineKanbanClient'

export const metadata: Metadata = { title: 'Pipeline' }

export default function PipelinePage() {
  return <PipelineKanbanClient />
}
