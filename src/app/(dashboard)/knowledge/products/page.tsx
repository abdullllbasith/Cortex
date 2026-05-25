import type { Metadata } from 'next'
import { ProductsKnowledgePageContent } from '@/components/knowledge/ProductsKnowledgePageContent'

export const metadata: Metadata = { title: 'Product Knowledge' }

export default function ProductsKnowledgePage() {
  return <ProductsKnowledgePageContent />
}
