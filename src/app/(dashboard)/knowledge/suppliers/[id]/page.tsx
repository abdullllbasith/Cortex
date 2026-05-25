import type { Metadata } from 'next'
import { SupplierKnowledgeDetailClient } from '@/components/knowledge/SupplierKnowledgeDetailClient'

export const metadata: Metadata = { title: 'Supplier Detail' }

export default async function SupplierKnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SupplierKnowledgeDetailClient supplierId={id} />
}
