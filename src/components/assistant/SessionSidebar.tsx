'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { Plus, MessageSquare, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { apiClient, swrFetcher, normalizeApiList } from '@/lib/api/apiClient'
import type { PaginatedResponse } from '@/lib/api/types'
import { formatDistanceToNow } from 'date-fns'

interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  lastMessage?: { content: string; role: string } | null
}

interface SessionSidebarProps {
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  className?: string
}

export function SessionSidebar({
  activeSessionId,
  onSelectSession,
  onNewSession,
  className,
}: SessionSidebarProps) {
  const { data: sessionsRaw, mutate, isLoading } = useSWR<
    SessionSummary[] | PaginatedResponse<SessionSummary>
  >('/assistant/sessions', swrFetcher, { refreshInterval: 30000 })

  const sessions = normalizeApiList<SessionSummary>(sessionsRaw)

  useEffect(() => {
    if (activeSessionId) mutate()
  }, [activeSessionId, mutate])

  const handleArchive = async (sessionId: string) => {
    await apiClient.delete('/assistant/sessions', { params: { sessionId } })
    mutate()
    if (activeSessionId === sessionId) onNewSession()
  }

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50',
        className,
      )}
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <Button
          onClick={onNewSession}
          variant="secondary"
          className="w-full justify-start gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          New conversation
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-area p-2 space-y-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8 px-2">
            No conversations yet. Start a new chat!
          </p>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'group flex items-start gap-1 rounded-lg transition-colors',
              activeSessionId === session.id
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectSession(session.id)}
              className="flex-1 min-w-0 flex items-start gap-2 px-3 py-2.5 text-left rounded-lg"
            >
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.title}</p>
                {session.lastMessage && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {session.lastMessage.content}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleArchive(session.id)}
              aria-label="Archive conversation"
              className="opacity-0 group-hover:opacity-100 mt-2 mr-2 p-1 rounded text-slate-400 hover:text-red-500 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
