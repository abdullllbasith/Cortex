import type { SecurityEventType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { notificationService } from '@/lib/notifications/notificationService'
import { renderNotificationTemplate } from '@/lib/notifications/notificationTemplates'

export interface SecurityEventInput {
  tenantId: string
  userId?: string | null
  eventType: SecurityEventType
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      metadata: (input.metadata ?? {}) as object,
      ipAddress: input.ipAddress ?? null,
    },
  })

  if (input.eventType === 'LOGIN_FAILED') {
    await detectBruteForce(input.tenantId, input.userId, input.ipAddress)
  }
}

async function detectBruteForce(
  tenantId: string,
  userId?: string | null,
  ipAddress?: string | null,
): Promise<void> {
  const since = new Date(Date.now() - 10 * 60 * 1000)
  const count = await prisma.securityEvent.count({
    where: {
      tenantId,
      eventType: 'LOGIN_FAILED',
      timestamp: { gte: since },
      OR: [
        userId ? { userId } : undefined,
        ipAddress ? { ipAddress } : undefined,
      ].filter(Boolean) as Array<{ userId: string } | { ipAddress: string }>,
    },
  })

  if (count >= 5) {
    if (userId) {
      await prisma.user.updateMany({
        where: { id: userId, tenantId },
        data: { isActive: false },
      })
    }

    const owner = await prisma.user.findFirst({
      where: { tenantId, role: 'OWNER', isActive: true },
      select: { id: true },
    })

    await prisma.securityEvent.create({
      data: {
        tenantId,
        userId,
        eventType: 'SUSPICIOUS_ACTIVITY',
        metadata: { reason: 'brute_force', failedAttempts: count },
        ipAddress: ipAddress ?? null,
      },
    })

    if (owner) {
      try {
        await prisma.alert.create({
          data: {
            tenantId,
            type: 'GENERAL',
            severity: 'CRITICAL',
            title: 'Brute force login detected',
            message: `Account locked after ${count} failed login attempts.`,
            metadata: { userId, ipAddress, source: 'security_monitor' },
          },
        })
        await notificationService.send({
          tenantId,
          userId: owner.id,
          title: 'Brute force login detected',
          body: `Account locked after ${count} failed login attempts.`,
          type: 'SECURITY',
          severity: 'CRITICAL',
          actionUrl: '/settings/audit',
          actionLabel: 'Review audit log',
          entityId: userId ?? ipAddress ?? 'brute_force',
        })
      } catch {
        // alerts optional
      }
    }
  }
}

export async function detectBulkDelete(
  tenantId: string,
  userId: string,
  deleteCount: number,
): Promise<boolean> {
  if (deleteCount <= 50) return false

  await logSecurityEvent({
    tenantId,
    userId,
    eventType: 'BULK_DELETE',
    metadata: { count: deleteCount },
  })

  return true
}

export async function recordLoginSuccess(
  tenantId: string,
  userId: string,
  ipAddress?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await logSecurityEvent({
    tenantId,
    userId,
    eventType: 'LOGIN_SUCCESS',
    ipAddress,
    metadata,
  })

  const rendered = renderNotificationTemplate('SECURITY_LOGIN', {
    location: ipAddress ?? 'Unknown location',
    device: (metadata?.userAgent as string)?.slice(0, 60) ?? 'Unknown device',
  })

  await notificationService.send({
    tenantId,
    userId,
    title: rendered.title,
    body: rendered.body,
    type: rendered.type,
    severity: rendered.severity,
    actionUrl: rendered.actionUrl,
    actionLabel: rendered.actionLabel,
    entityId: `login-${Date.now()}`,
  }).catch(() => {})

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })
}

export async function recordLoginFailed(
  tenantId: string,
  email: string,
  ipAddress?: string | null,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { tenantId, email },
    select: { id: true },
  })

  await logSecurityEvent({
    tenantId,
    userId: user?.id,
    eventType: 'LOGIN_FAILED',
    ipAddress,
    metadata: { email },
  })
}
