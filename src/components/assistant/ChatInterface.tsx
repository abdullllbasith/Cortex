'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'
import { useAssistantChat } from '@/hooks/useAssistantChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { CommandSuggestions } from './CommandSuggestions'
import { SessionSidebar } from './SessionSidebar'
import { apiClient } from '@/lib/api/apiClient'
import type { ActionTaken } from '@/lib/assistant/types'

interface ChatInterfaceProps {
  className?: string
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn('flex gap-3', i % 2 === 0 ? 'flex-row-reverse' : 'flex-row')}>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className={cn('h-12 rounded-2xl', i % 2 === 0 ? 'w-2/5' : 'w-3/5')} />
        </div>
      ))}
    </div>
  )
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const {
    messages,
    sessionId,
    isStreaming,
    isTyping,
    isLoadingHistory,
    sendMessage,
    switchSession,
    clearChat,
  } = useAssistantChat()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isTyping, isLoadingHistory])

  const handleUndoAction = useCallback(async (action: ActionTaken) => {
    try {
      const res = await apiClient.post<{ undone: boolean }>(
        '/assistant/actions/undo',
        { action },
      )
      return res.undone ?? false
    } catch {
      return false
    }
  }, [])

  const handleSuggestion = (text: string) => {
    sendMessage(text)
  }

  const showSuggestions =
    !isLoadingHistory && messages.length === 0 && !isStreaming

  return (
    <div className={cn('flex h-full min-h-0', className)}>
      <SessionSidebar
        activeSessionId={sessionId}
        onSelectSession={switchSession}
        onNewSession={clearChat}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            <MessageSkeleton />
          ) : showSuggestions ? (
            <div className="flex items-center justify-center h-full p-6">
              <CommandSuggestions onSelect={handleSuggestion} />
            </div>
          ) : (
            <div className="py-4 space-y-1">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onUndoAction={handleUndoAction}
                />
              ))}

              {isTyping && isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 px-4 py-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
                  >
                    <Bot
                      className="w-4 h-4"
                      style={{ color: 'var(--color-brand-on-primary, #ffffff)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-xs text-slate-400 self-center">SAIOS is thinking…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}
