import { authenticateTenantRequest, TenantAuthError } from '@/middleware/tenantAuth'
import { apiError } from '@/lib/knowledge/response'
import { registerSseConnection } from '@/lib/notifications/sseManager'
import { startNotificationPubSubListener } from '@/lib/notifications/pubsub'

startNotificationPubSubListener()

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await authenticateTenantRequest(request as never)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(': connected\n\n'))

        const cleanup = registerSseConnection(auth.tenantId, auth.userId, controller)

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeat)
            cleanup()
          }
        }, 30_000)

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          cleanup()
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    if (err instanceof TenantAuthError) {
      return apiError(err.message, err.code, err.statusCode)
    }
    return apiError('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
