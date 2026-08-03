import type { Metadata } from 'next'
import WorkflowsPageClient from '@/app/(dashboard)/workflows/WorkflowsPageClient'

export const metadata: Metadata = { title: 'Workflows' }

export default function WorkflowsPage() {
  return <WorkflowsPageClient />
}
