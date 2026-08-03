import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupportTicketPriority, SupportTicketStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().nullable().optional(),
  resolution: z.string().max(10000).nullable().optional(),
})

export const GET = requireAdminAuth(async (_request, { params }) => {
  try {
    const { id } = await params
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    })
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: { message: 'Ticket not found', code: 'NOT_FOUND' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(ticket))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = requireAdminAuth(async (request, { params }) => {
  try {
    const { id } = await params
    const body = updateSchema.parse(await request.json())

    const existing = await prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: 'Ticket not found', code: 'NOT_FOUND' } },
        { status: 404 },
      )
    }

    const resolvedAt =
      body.status === 'RESOLVED' || body.status === 'CLOSED'
        ? new Date()
        : existing.resolvedAt

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status as SupportTicketStatus } : {}),
        ...(body.priority ? { priority: body.priority as SupportTicketPriority } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
        ...(body.resolution !== undefined ? { resolution: body.resolution } : {}),
        resolvedAt,
      },
      include: {
        tenant: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    })

    return NextResponse.json(apiSuccess(ticket))
  } catch (err) {
    return handleRouteError(err)
  }
})
