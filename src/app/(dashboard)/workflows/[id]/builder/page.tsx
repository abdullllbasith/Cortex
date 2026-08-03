import type { Metadata } from 'next'
import WorkflowBuilderPageClient from './WorkflowBuilderPageClient'

export const metadata: Metadata = { title: 'Workflow Builder' }

export default async function WorkflowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WorkflowBuilderPageClient id={id} />
}
