import type { Metadata } from 'next'
import WorkflowsPageClient from './WorkflowsPageClient'

export const metadata: Metadata = { title: 'Workflows' }

export default function WorkflowsPage() {
  return <WorkflowsClient />
}

function WorkflowsClient() {
  return <WorkflowsPageClient />
}
