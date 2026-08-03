import type { SseEvent } from './types'

type Connection = {
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
}

const connections = new Map<string, Set<Connection>>()

function connKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`
}

function encodeEvent(event: SseEvent): Uint8Array {
  const encoder = new TextEncoder()
  if (event.type === 'heartbeat') {
    return encoder.encode(': heartbeat\n\n')
  }
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

export function registerSseConnection(
  tenantId: string,
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): () => void {
  const key = connKey(tenantId, userId)
  const encoder = new TextEncoder()
  const conn: Connection = { controller, encoder }
  const set = connections.get(key) ?? new Set()
  set.add(conn)
  connections.set(key, set)

  return () => {
    set.delete(conn)
    if (set.size === 0) connections.delete(key)
  }
}

export function emitToUser(tenantId: string, userId: string, event: SseEvent): void {
  const set = connections.get(connKey(tenantId, userId))
  if (!set?.size) return
  const chunk = encodeEvent(event)
  for (const conn of set) {
    try {
      conn.controller.enqueue(chunk)
    } catch {
      set.delete(conn)
    }
  }
}

export function emitReadAll(tenantId: string, userId: string): void {
  emitToUser(tenantId, userId, { type: 'read_all' })
}

export function activeConnectionCount(): number {
  let n = 0
  for (const set of connections.values()) n += set.size
  return n
}
