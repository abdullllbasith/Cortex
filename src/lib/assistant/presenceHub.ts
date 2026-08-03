import { EventEmitter } from 'events'
import { getRedis } from '@/lib/cache/redis'

export type PresenceEvent =
  | { type: 'typing'; sessionId: string; userId: string; isTyping: boolean; at: number }
  | { type: 'presence'; sessionId: string; userId: string; status: 'online' | 'offline' | 'away'; at: number }

const hub = new EventEmitter()
hub.setMaxListeners(100)

const CHANNEL_PREFIX = 'saios:assistant:presence:'

function sessionChannel(sessionId: string): string {
  return `${CHANNEL_PREFIX}${sessionId}`
}

export function publishPresenceEvent(event: PresenceEvent): void {
  hub.emit(sessionChannel(event.sessionId), event)

  const redis = getRedis()
  if (redis) {
    redis
      .publish(sessionChannel(event.sessionId), JSON.stringify(event))
      .catch(() => { /* non-fatal */ })
  }
}

export function subscribePresenceEvents(
  sessionId: string,
  onEvent: (event: PresenceEvent) => void,
): () => void {
  const channel = sessionChannel(sessionId)
  const handler = (event: PresenceEvent) => onEvent(event)
  hub.on(channel, handler)

  const redis = getRedis()
  let redisSub: ReturnType<typeof getRedis> | null = null

  if (redis) {
    redisSub = redis.duplicate()
    redisSub.subscribe(channel).catch(() => { /* non-fatal */ })
    redisSub.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          onEvent(JSON.parse(message) as PresenceEvent)
        } catch { /* ignore */ }
      }
    })
  }

  return () => {
    hub.off(channel, handler)
    if (redisSub) {
      redisSub.unsubscribe(channel).catch(() => { /* non-fatal */ })
      redisSub.disconnect()
    }
  }
}

export function formatSseEvent(event: PresenceEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
