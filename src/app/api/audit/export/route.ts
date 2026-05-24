import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'
import { log } from '@/lib/audit/auditLogger'
import { extractRequestMeta } from '@/lib/audit/auditLogger'
import { logSecurityEvent } from '@/lib/audit/securityMonitor'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

const schema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  userId: z.string().optional(),
})

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return 'id,tenantId,userId,action,resourceType,resourceId,timestamp,severity\n'
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
  }
  return lines.join('\n')
}

export const POST = requirePermission(PERMISSIONS.AUDIT_EXPORT)(async (request, { auth }) => {
  try {
    const body = schema.parse(await request.json().catch(() => ({})))
    const where = {
      tenantId: auth.tenantId,
      ...(body.userId ? { userId: body.userId } : {}),
      ...(body.from || body.to
        ? {
            timestamp: {
              ...(body.from ? { gte: new Date(body.from) } : {}),
              ...(body.to ? { lte: new Date(body.to) } : {}),
            },
          }
        : {}),
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10_000,
    })

    const meta = extractRequestMeta(request)
    log({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'export_audit_logs',
      resourceType: 'audit_log',
      severity: 'WARNING',
      newValue: { count: logs.length, filters: body },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    await logSecurityEvent({
      tenantId: auth.tenantId,
      userId: auth.userId,
      eventType: 'DATA_EXPORT',
      ipAddress: meta.ipAddress,
      metadata: { type: 'audit_logs', count: logs.length },
    })

    const csv = toCsv(logs as unknown as Array<Record<string, unknown>>)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-export-${Date.now()}.csv"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
})
