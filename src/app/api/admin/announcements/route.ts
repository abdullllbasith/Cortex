import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { AnnouncementType, TenantPlan } from '@prisma/client'
import { requireAdminAuth } from '@/middleware/adminAuth'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { listAnnouncements, sendAnnouncement } from '@/lib/admin/broadcastService'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  type: z.enum(['MAINTENANCE', 'FEATURE', 'URGENT']),
  targetPlans: z.array(z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])).optional(),
  targetTenantIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
})

export const GET = requireAdminAuth(async (request) => {
  try {
    const activeOnly = request.nextUrl.searchParams.get('active') === 'true'
    const announcements = await listAnnouncements(activeOnly)
    return NextResponse.json(apiSuccess(announcements))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = requireAdminAuth(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const result = await sendAnnouncement({
      title: body.title,
      body: body.body,
      type: body.type as AnnouncementType,
      targetPlans: body.targetPlans as TenantPlan[] | undefined,
      targetTenantIds: body.targetTenantIds,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive,
      sendEmail: body.sendEmail,
      createdById: auth.adminUserId,
    })
    return NextResponse.json(apiSuccess(result), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
