import type { Metadata } from 'next'
import { ProductKnowledgeDetailClient } from '@/components/knowledge/ProductKnowledgeDetailClient'

export const metadata: Metadata = { title: 'Product Detail' }

export default async function ProductKnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProductKnowledgeDetailClient productId={id} />
}
