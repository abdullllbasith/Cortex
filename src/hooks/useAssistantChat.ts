'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSessionSnapshot } from '@/store/sessionStore'
import {
  clearLastAssistantSessionId,
  getLastAssistantSessionId,
  setLastAssistantSessionId,
} from '@/lib/assistant/assistantSessionStorage'
import type { ActionTaken } from '@/lib/assistant/types'
import type { SemanticSearchResult } from '@/lib/embeddings/semanticSearch'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  sourcesUsed?: SemanticSearchResult[]
  actionsTaken?: ActionTaken[]
  suggestedFollowUps?: string[]
  error?: boolean
  createdAt: Date
}

interface StreamMetadata {
  sessionId?: string
  sourcesUsed?: SemanticSearchResult[]
  actionsTaken?: ActionTaken[]
  suggestedFollowUps?: string[]
}

function authHeaders(): Record<string, string> {
  const session = getSessionSnapshot()
  return {
    Accept: 'application/json',
    ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    ...(session.tenant?.id
      ? { 'x-tenant-id': session.tenant.id }
      : process.env.NODE_ENV === 'development'
        ? { 'x-tenant-id': 'dev-tenant-1' }
        : {}),
  }
}

export function useAssistantChat(initialSessionId?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const restoredRef = useRef(false)

  const persistSessionId = useCallback((sid: string | null) => {
    setSessionId(sid)
    if (sid) setLastAssistantSessionId(sid)
    else clearLastAssistantSessionId()
  }, [])

  const loadMessages = useCallback(async (sid: string) => {
    setIsLoadingHistory(true)
    const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
    try {
      const res = await fetch(`${base}/assistant/sessions/${sid}/messages?limit=40`, {
        headers: authHeaders(),
      })
      if (res.status === 404) {
        clearLastAssistantSessionId()
        setSessionId(null)
        setMessages([])
        return
      }
      if (!res.ok) return

      const json = await res.json() as {
        data?: Array<Omit<ChatMessage, 'createdAt'> & { createdAt: string }>
      }
      const rows = Array.isArray(json.data) ? json.data : []
      setMessages(
        rows.map((m) => ({
          ...m,
          role: m.role as 'user' | 'assistant',
          createdAt: new Date(m.createdAt),
        })),
      )
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const sid = initialSessionId ?? getLastAssistantSessionId()
    if (!sid) return

    setSessionId(sid)
    void loadMessages(sid)
  }, [initialSessionId, loadMessages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      createdAt: new Date(),
    }

    const assistantId = `tmp-asst-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setIsTyping(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const base = process.env.NEXT_PUBLIC_API_URL ?? '/api'
    const streamHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...authHeaders(),
    }

    const payload: { message: string; sessionId?: string } = { message: text.trim() }
    if (sessionId) payload.sessionId = sessionId

    try {
      const res = await fetch(`${base}/assistant/chat`, {
        method: 'POST',
        headers: streamHeaders,
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') ?? '60'
        throw new Error(`Rate limited. Retry in ${retryAfter}s.`)
      }

      if (!res.ok || !res.body) {
        let detail = 'Failed to send message'
        try {
          const errJson = await res.json() as { error?: { message?: string } }
          if (errJson.error?.message) detail = errJson.error.message
        } catch { /* non-json */ }
        throw new Error(detail)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: StreamMetadata = {}

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload) as {
              type: string
              content?: string
              sessionId?: string
              sourcesUsed?: SemanticSearchResult[]
              actionsTaken?: ActionTaken[]
              suggestedFollowUps?: string[]
            }

            if (parsed.type === 'session' && parsed.sessionId) {
              persistSessionId(parsed.sessionId)
              metadata.sessionId = parsed.sessionId
            } else if (parsed.type === 'status') {
              setIsTyping(true)
            } else if (parsed.type === 'token' && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m,
                ),
              )
            } else if (parsed.type === 'metadata') {
              metadata = { ...metadata, ...parsed }
            }
          } catch {
            /* skip malformed SSE chunks */
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                sourcesUsed: metadata.sourcesUsed,
                actionsTaken: metadata.actionsTaken,
                suggestedFollowUps: metadata.suggestedFollowUps,
              }
            : m,
        ),
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const errorText =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errorText, streaming: false, error: true }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
      setIsTyping(false)
    }
  }, [isStreaming, sessionId, persistSessionId])

  const switchSession = useCallback(async (sid: string | null) => {
    abortRef.current?.abort()
    persistSessionId(sid)
    setMessages([])
    if (sid) await loadMessages(sid)
  }, [loadMessages, persistSessionId])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    persistSessionId(null)
    setMessages([])
  }, [persistSessionId])

  return {
    messages,
    sessionId,
    isStreaming,
    isTyping,
    isLoadingHistory,
    sendMessage,
    switchSession,
    clearChat,
    loadMessages,
    setIsTyping,
  }
}
