import type { Metadata } from 'next'
import { BookOpen } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Knowledge Base' }
export default function KnowledgePage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Knowledge Base" subtitle="Structured enterprise data across customers, products, and suppliers" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Knowledge Base' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<BookOpen />} title="Knowledge Base — Module 04" description="Browse and search all entity types with AI-powered insights." /></div>
    </div>
  )
}
