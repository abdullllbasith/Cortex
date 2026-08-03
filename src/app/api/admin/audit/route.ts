import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

export const GET = requireAdminAuth(async (request) => {
  try {
    const sp = request.nextUrl.searchParams
    const tenantId = sp.get('tenantId')
    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)))

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: tenantId
          ? { OR: [{ targetType: 'tenants', targetId: tenantId }, { targetId: tenantId }] }
          : undefined,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          adminUser: { select: { fullName: true, email: true } },
        },
      }),
      prisma.adminAuditLog.count({
        where: tenantId
          ? { OR: [{ targetType: 'tenants', targetId: tenantId }, { targetId: tenantId }] }
          : undefined,
      }),
    ])

    return NextResponse.json(apiSuccess({ logs, total, page, limit }))
  } catch (err) {
    return handleRouteError(err)
  }
})
