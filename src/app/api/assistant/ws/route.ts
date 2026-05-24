import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiError } from '@/lib/knowledge/response'
import { presenceEventSchema } from '@/lib/assistant/schemas'
import {
  publishPresenceEvent,
  subscribePresenceEvents,
  formatSseEvent,
} from '@/lib/assistant/presenceHub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Real-time presence & typing channel.
 * Uses Server-Sent Events (SSE) for serverless compatibility.
 * Clients POST typing events here; GET opens an SSE subscription.
 */
export const GET = withTenantAuth(async (request, { auth }) => {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return apiError('sessionId is required', 'VALIDATION_ERROR', 400)
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      controller.enqueue(
        encoder.encode(
          formatSseEvent({
            type: 'presence',
            sessionId,
            userId: auth.userId,
            status: 'online',
            at: Date.now(),
          }),
        ),
      )

      const unsubscribe = subscribePresenceEvents(sessionId, (event) => {
        try {
          controller.enqueue(encoder.encode(formatSseEvent(event)))
        } catch {
          unsubscribe()
        }
      })

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 15000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        publishPresenceEvent({
          type: 'presence',
          sessionId,
          userId: auth.userId,
          status: 'offline',
          at: Date.now(),
        })
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = presenceEventSchema.parse(await request.json())

    if (body.type === 'typing') {
      publishPresenceEvent({
        type: 'typing',
        sessionId: body.sessionId,
        userId: auth.userId,
        isTyping: body.isTyping ?? false,
        at: Date.now(),
      })
    } else {
      publishPresenceEvent({
        type: 'presence',
        sessionId: body.sessionId,
        userId: auth.userId,
        status: body.status ?? 'online',
        at: Date.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err)
  }
})
