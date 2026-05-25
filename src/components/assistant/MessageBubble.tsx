'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { SourceCitations } from './SourceCitations'
import { ActionConfirmCard } from './ActionConfirmCard'
import { useSessionStore } from '@/store/sessionStore'
import type { ChatMessage } from '@/hooks/useAssistantChat'
import type { ActionTaken } from '@/lib/assistant/types'

interface MessageBubbleProps {
  message: ChatMessage
  onUndoAction?: (action: ActionTaken) => Promise<boolean>
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
      style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
    >
      <Bot
        className="w-4 h-4"
        style={{ color: 'var(--color-brand-on-primary, #ffffff)' }}
        aria-hidden="true"
      />
    </div>
  )
}

export function MessageBubble({ message, onUndoAction }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const user = useSessionStore((s) => s.user)
  const displayName = user?.name ?? 'You'

  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {isUser ? (
        <Avatar
          size="sm"
          name={displayName}
          src={user?.avatarUrl}
          className="shrink-0 mt-1"
        />
      ) : (
        <AssistantAvatar />
      )}

      <div className={cn('flex max-w-[75%] min-w-0 flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'w-fit rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'chat-user-bubble rounded-tr-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm',
            message.error && !isUser && 'border border-red-200 dark:border-red-800',
          )}
        >
          {message.streaming && !message.content ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-pre:bg-slate-900 prose-pre:text-slate-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ' '}
              </ReactMarkdown>
              {message.streaming && message.content && (
                <span
                  className="inline-block w-1.5 h-4 animate-pulse ml-0.5 align-middle"
                  style={{ backgroundColor: 'var(--color-brand, #4f46e5)' }}
                />
              )}
            </div>
          )}
        </div>

        {!isUser && !message.streaming && message.sourcesUsed && message.sourcesUsed.length > 0 && (
          <SourceCitations sources={message.sourcesUsed} />
        )}

        {!isUser && !message.streaming && message.actionsTaken && message.actionsTaken.length > 0 && (
          <ActionConfirmCard actions={message.actionsTaken} onUndo={onUndoAction} />
        )}
      </div>
    </div>
  )
}
