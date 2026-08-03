import type { AuditSeverity } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { maskSensitiveFields } from '@/lib/security/sanitizer'

export interface AuditEvent {
  tenantId: string
  userId?: string | null
  sessionId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  previousValue?: unknown
  newValue?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  severity?: AuditSeverity
}

/** Non-blocking fire-and-forget audit write */
export function log(event: AuditEvent): void {
  void writeAudit(event).catch((err) => console.error('[audit]', err))
}

async function writeAudit(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: event.tenantId,
      userId: event.userId ?? null,
      sessionId: event.sessionId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      previousValue: event.previousValue != null ? maskSensitiveFields(event.previousValue) as object : undefined,
      newValue: event.newValue != null ? maskSensitiveFields(event.newValue) as object : undefined,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      severity: event.severity ?? 'INFO',
    },
  })
}

/** Batch writes — queued when BullMQ available, else sequential */
export async function logBatch(events: AuditEvent[]): Promise<void> {
  if (events.length === 0) return

  try {
    const { getBullmqConnection } = await import('@/lib/cache/redis')
    const conn = getBullmqConnection()
    if (conn) {
      const { Queue } = await import('bullmq')
      const queue = new Queue('audit-log', { connection: conn })
      await queue.add('batch', { events: events.map((e) => ({
        ...e,
        previousValue: e.previousValue != null ? maskSensitiveFields(e.previousValue) : undefined,
        newValue: e.newValue != null ? maskSensitiveFields(e.newValue) : undefined,
      })) })
      return
    }
  } catch {
    // fall through to direct writes
  }

  await Promise.all(events.map((e) => writeAudit(e)))
}

export function extractRequestMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  }
}
