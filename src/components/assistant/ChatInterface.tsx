'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { Bot, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui'
import { useAssistantChat } from '@/hooks/useAssistantChat'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { CommandSuggestions } from './CommandSuggestions'
import { SessionSidebar } from './SessionSidebar'
import { AssistantSessionDrawer } from './AssistantSessionDrawer'
import { apiClient } from '@/lib/api/apiClient'
import type { ActionTaken } from '@/lib/assistant/types'

interface ChatInterfaceProps {
  className?: string
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 px-3 py-6 sm:px-4">
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
  const isMobile = useIsMobile()
  const [sessionsOpen, setSessionsOpen] = useState(false)

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
      {!isMobile && (
        <SessionSidebar
          activeSessionId={sessionId}
          onSelectSession={switchSession}
          onNewSession={clearChat}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile && (
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              aria-label="Show conversations"
              onClick={() => setSessionsOpen(true)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI Assistant
            </span>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-area">
          {isLoadingHistory ? (
            <MessageSkeleton />
          ) : showSuggestions ? (
            <div className="flex h-full items-center justify-center p-4 sm:p-6">
              <CommandSuggestions onSelect={handleSuggestion} />
            </div>
          ) : (
            <div className="space-y-1 py-3 sm:py-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onUndoAction={handleUndoAction}
                />
              ))}

              {isTyping && isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 px-3 py-2 sm:px-4">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
                  >
                    <Bot
                      className="h-4 w-4"
                      style={{ color: 'var(--color-brand-on-primary, #ffffff)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="self-center text-xs text-slate-400">Cortex is thinking…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <ChatInput onSend={sendMessage} disabled={isStreaming} />
        </div>
      </div>

      {isMobile && (
        <AssistantSessionDrawer
          open={sessionsOpen}
          onOpenChange={setSessionsOpen}
          activeSessionId={sessionId}
          onSelectSession={switchSession}
          onNewSession={clearChat}
        />
      )}
    </div>
  )
}
