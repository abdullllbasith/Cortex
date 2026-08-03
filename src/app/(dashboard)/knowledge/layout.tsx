import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Knowledge Base',
  description: 'Enterprise Knowledge Engine with AI-powered semantic search',
}

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return children
}
