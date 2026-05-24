import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { createInvitations } from '@/lib/settings/teamService'
import { resendInvitation, revokeInvitation } from '@/lib/settings/teamService'
import type { UserRole } from '@prisma/client'

const inviteSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.enum(['CEO', 'MANAGER', 'FINANCE_OFFICER', 'SALES_OFFICER', 'EMPLOYEE']),
      }),
    )
    .min(1)
    .max(10),
  message: z.string().max(2000).optional(),
})

export const POST = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth }) => {
  try {
    const body = inviteSchema.parse(await request.json())
    const sent = await createInvitations(
      auth.tenantId,
      auth.userId,
      body.invites.map((i) => ({ email: i.email, role: i.role as UserRole })),
      body.message,
    )
    return NextResponse.json(apiSuccess({ sent }), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PATCH = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth }) => {
  try {
    const body = z.object({ invitationId: z.string() }).parse(await request.json())
    const updated = await resendInvitation(auth.tenantId, body.invitationId)
    return NextResponse.json(
      apiSuccess({
        id: updated.id,
        email: updated.email,
        expiresAt: updated.expiresAt.toISOString(),
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const DELETE = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth }) => {
  try {
    const invitationId = new URL(request.url).searchParams.get('id')
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: { message: 'Invitation id required' } },
        { status: 400 },
      )
    }
    const result = await revokeInvitation(auth.tenantId, invitationId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
