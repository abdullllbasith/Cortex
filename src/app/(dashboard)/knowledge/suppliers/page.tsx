import type { Metadata } from 'next'
import { SuppliersKnowledgePageContent } from '@/components/knowledge/SuppliersKnowledgePageContent'

export const metadata: Metadata = { title: 'Supplier Knowledge' }

export default function SuppliersKnowledgePage() {
  return <SuppliersKnowledgePageContent />
}
