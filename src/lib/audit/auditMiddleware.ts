import { NextRequest, NextResponse } from 'next/server'
import { log, extractRequestMeta, type AuditEvent } from '@/lib/audit/auditLogger'
import type { TenantAuthContext } from '@/middleware/tenantAuth'

export interface AuditRouteOptions {
  skipAudit?: boolean
  resourceType: string
  action?: string
}

type AuditedHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; auth: TenantAuthContext },
) => Promise<NextResponse>

/** Wraps mutating API handlers with automatic audit capture */
export function withAudit(
  options: AuditRouteOptions,
  handler: AuditedHandler,
): AuditedHandler {
  return async (request, context) => {
    if (options.skipAudit) return handler(request, context)

    const method = request.method.toUpperCase()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return handler(request, context)
    }

    const { ipAddress, userAgent } = extractRequestMeta(request)
    let previousValue: unknown
    let bodySnapshot: unknown

    if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      try {
        const params = await context.params
        const id = params.id ?? params.execId ?? params.taskId
        if (id) {
          previousValue = { id, method }
        }
      } catch {
        // ignore
      }
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const clone = request.clone()
        bodySnapshot = await clone.json()
      } catch {
        bodySnapshot = null
      }
    }

    const response = await handler(request, context)

    const action = options.action ?? `${method.toLowerCase()}_${options.resourceType}`
    const event: AuditEvent = {
      tenantId: context.auth.tenantId,
      userId: context.auth.userId,
      action,
      resourceType: options.resourceType,
      ipAddress,
      userAgent,
      severity: method === 'DELETE' ? 'WARNING' : 'INFO',
    }

    if (method === 'DELETE') {
      event.previousValue = previousValue
    } else if (method === 'POST') {
      event.newValue = bodySnapshot
    } else {
      event.previousValue = previousValue
      event.newValue = bodySnapshot
    }

    log(event)
    return response
  }
}

/** Decorator-style skip marker for routes that opt out */
export const skipAudit = { skipAudit: true as const }
