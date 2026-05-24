import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupportTicketPriority, SupportTicketStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

const createSchema = z.object({
  tenantId: z.string(),
  userId: z.string().optional(),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

export const GET = requireAdminAuth(async (request) => {
  try {
    const sp = request.nextUrl.searchParams
    const status = sp.get('status') as SupportTicketStatus | null
    const tenantId = sp.get('tenantId')
    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 20)))

    const where = {
      ...(status ? { status } : {}),
      ...(tenantId ? { tenantId } : {}),
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ])

    return NextResponse.json(apiSuccess({ tickets, total, page, limit }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = requireAdminAuth(async (request) => {
  try {
    const body = createSchema.parse(await request.json())
    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: body.tenantId,
        userId: body.userId ?? null,
        subject: body.subject,
        description: body.description,
        priority: (body.priority ?? 'MEDIUM') as SupportTicketPriority,
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(apiSuccess(ticket), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
