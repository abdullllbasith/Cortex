import type { Metadata } from 'next'
import { ChatInterface } from '@/components/assistant/ChatInterface'

export const metadata: Metadata = { title: 'AI Assistant' }

export default function AssistantPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatInterface className="min-h-0 flex-1" />
    </div>
  )
}
