import { getRedis } from '@/lib/cache/redis'
import { emitReadAll, emitToUser } from './sseManager'
import type { SseEvent } from './types'

const CHANNEL = 'saios:notifications'

export async function publishNotificationEvent(
  tenantId: string,
  userId: string,
  event: SseEvent,
): Promise<void> {
  emitToUser(tenantId, userId, event)

  const redis = getRedis()
  if (!redis) return

  try {
    await redis.publish(
      CHANNEL,
      JSON.stringify({ tenantId, userId, event }),
    )
  } catch {
    /* in-process SSE still works */
  }
}

export async function publishReadAllEvent(tenantId: string, userId: string): Promise<void> {
  emitReadAll(tenantId, userId)

  const redis = getRedis()
  if (!redis) return

  try {
    await redis.publish(
      CHANNEL,
      JSON.stringify({ tenantId, userId, event: { type: 'read_all' } }),
    )
  } catch {
    /* ignore */
  }
}

export function startNotificationPubSubListener(): void {
  const redis = getRedis()
  if (!redis) return

  const sub = redis.duplicate()
  sub.subscribe(CHANNEL).catch(() => {})
  sub.on('message', (_channel, message) => {
    try {
      const parsed = JSON.parse(message) as {
        tenantId: string
        userId: string
        event: SseEvent
      }
      emitToUser(parsed.tenantId, parsed.userId, parsed.event)
    } catch {
      /* ignore malformed */
    }
  })
}
