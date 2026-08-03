import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'Documents' }
export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Documents" subtitle="Uploaded files, contracts, and parsed content" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Knowledge Base', href: '/knowledge' }, { label: 'Documents' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<FileText />} title="Documents — Module 04" description="Document library with AI parsing, chunking, and semantic search." /></div>
    </div>
  )
}
