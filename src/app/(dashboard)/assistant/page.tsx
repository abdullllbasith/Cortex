'use client'

import { ChatInterface } from '@/components/assistant'

export default function AssistantPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-0px)]">
      <ChatInterface className="h-full flex-1 min-h-0" />
    </div>
  )
}
