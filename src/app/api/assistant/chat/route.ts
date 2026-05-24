import { NextRequest, NextResponse } from 'next/server'
import { MessageRole, ConversationIntent } from '@prisma/client'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiError } from '@/lib/knowledge/response'
import { chatRequestSchema } from '@/lib/assistant/schemas'
import { checkAssistantRateLimit } from '@/lib/assistant/rateLimiter'
import { streamConversationEngine } from '@/lib/assistant/conversationEngine'
import {
  createSession,
  getSession,
  getContextWindow,
  saveMessage,
  updateSessionTitle,
} from '@/lib/assistant/conversationMemory'
import { publishPresenceEvent } from '@/lib/assistant/presenceHub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function encodeSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = chatRequestSchema.parse(await request.json())
    const tenantId = body.tenantId ?? auth.tenantId
    const userId = body.userId ?? auth.userId

    const rateCheck = await checkAssistantRateLimit(userId)
    if (!rateCheck.allowed) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter),
          },
        },
      )
    }

    let sessionId = body.sessionId
    if (sessionId) {
      const existing = await getSession(tenantId, sessionId, userId)
      if (!existing) {
        return apiError('Session not found', 'NOT_FOUND', 404)
      }
    } else {
      const session = await createSession(tenantId, userId)
      sessionId = session.id
    }

    publishPresenceEvent({
      type: 'typing',
      sessionId: sessionId!,
      userId: 'assistant',
      isTyping: true,
      at: Date.now(),
    })

    await saveMessage({
      sessionId: sessionId!,
      tenantId,
      role: MessageRole.USER,
      content: body.message,
    })

    const { recentTurns, summary } = await getContextWindow(tenantId, sessionId!)

    if (body.message.length <= 80 && recentTurns.length <= 1) {
      await updateSessionTitle(sessionId!, body.message.slice(0, 80))
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullAssistantMessage = ''
        let engineResult: {
          assistantMessage: string
          sourcesUsed: unknown[]
          actionsTaken: unknown[]
          suggestedFollowUps: string[]
          intent?: { intent: string; confidence: number }
        } | null = null

        try {
          controller.enqueue(encoder.encode(encodeSse({ type: 'session', sessionId })))

          for await (const chunk of streamConversationEngine({
            tenantId,
            userId,
            userMessage: body.message,
            conversationHistory: recentTurns.slice(0, -1),
            permissions: auth.permissions,
            sessionId: sessionId!,
            sessionSummary: summary,
          })) {
            if (chunk.type === 'token') {
              fullAssistantMessage += chunk.content
              controller.enqueue(encoder.encode(encodeSse({ type: 'token', content: chunk.content })))
            } else if (chunk.type === 'metadata') {
              engineResult = chunk.data
            }
          }

          const finalResult = engineResult ?? {
            assistantMessage: fullAssistantMessage,
            sourcesUsed: [],
            actionsTaken: [],
            suggestedFollowUps: [],
          }

          await saveMessage({
            sessionId: sessionId!,
            tenantId,
            role: MessageRole.ASSISTANT,
            content: finalResult.assistantMessage || fullAssistantMessage,
            intent: finalResult.intent?.intent as ConversationIntent | undefined,
            confidence: finalResult.intent?.confidence,
            sourcesUsed: finalResult.sourcesUsed as never[],
            actionsTaken: finalResult.actionsTaken as never[],
            suggestedFollowUps: finalResult.suggestedFollowUps,
          })

          controller.enqueue(
            encoder.encode(
              encodeSse({
                type: 'metadata',
                sessionId,
                sourcesUsed: finalResult.sourcesUsed,
                actionsTaken: finalResult.actionsTaken,
                suggestedFollowUps: finalResult.suggestedFollowUps,
                intent: finalResult.intent,
              }),
            ),
          )

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('[assistant/chat]', err)
          const fallback =
            "I'm having trouble connecting to the AI service right now. Your message has been saved — please try again in a moment."
          controller.enqueue(encoder.encode(encodeSse({ type: 'token', content: fallback })))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          await saveMessage({
            sessionId: sessionId!,
            tenantId,
            role: MessageRole.ASSISTANT,
            content: fallback,
            metadata: { error: true },
          })
        } finally {
          publishPresenceEvent({
            type: 'typing',
            sessionId: sessionId!,
            userId: 'assistant',
            isTyping: false,
            at: Date.now(),
          })
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})
