import type { Metadata } from 'next'
import { Bot } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
export const metadata: Metadata = { title: 'AI Assistant' }
export default function AssistantPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="AI Assistant" subtitle="Conversational AI powered by your enterprise knowledge" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'AI Assistant' }]} />
      <div className="flex-1 p-6"><EmptyState icon={<Bot />} title="AI Assistant — Module 03" description="Multi-turn chat with RAG, tool calling, and citation support." /></div>
    </div>
  )
}
