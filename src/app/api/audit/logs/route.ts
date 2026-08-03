import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import type { AuditSeverity } from '@prisma/client'

export const GET = requirePermission(PERMISSIONS.AUDIT_VIEW)(async (request, { auth }) => {
  try {
    const { searchParams } = request.nextUrl
    const tenantId = auth.tenantId
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 25)))
    const userId = searchParams.get('userId') ?? undefined
    const action = searchParams.get('action') ?? undefined
    const resourceType = searchParams.get('resourceType') ?? undefined
    const severity = searchParams.get('severity') as AuditSeverity | undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where = {
      tenantId,
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(severity ? { severity } : {}),
      ...(from || to
        ? {
            timestamp: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(apiSuccess({ items, total, page, limit }))
  } catch (err) {
    return handleRouteError(err)
  }
})
