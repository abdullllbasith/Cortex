import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { invalidatePermissionCache } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import {
  createCustomRole,
  getRolesPageData,
  updateCustomRole,
  deleteCustomRole,
} from '@/lib/settings/rolesService'
import { changeMemberRole } from '@/lib/settings/teamService'
import type { UserRole } from '@prisma/client'

const createSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  inheritFrom: z.string().optional(),
  categories: z.record(z.string(), z.boolean()).optional(),
})

const assignSchema = z.object({
  userId: z.string(),
  role: z.enum(['OWNER', 'CEO', 'MANAGER', 'FINANCE_OFFICER', 'SALES_OFFICER', 'EMPLOYEE']),
})

export const GET = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (_request, { auth }) => {
  try {
    const data = await getRolesPageData(auth.tenantId)
    const roleChanges = await prisma.roleChange.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { fullName: true } },
        changedBy: { select: { fullName: true } },
      },
    })
    return NextResponse.json(apiSuccess({ ...data, roleChanges }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const role = await createCustomRole(auth.tenantId, body)
    return NextResponse.json(apiSuccess(role), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})

/** @deprecated Use PUT /api/settings/team/[userId]/role */
export const PATCH = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth }) => {
  try {
    const body = assignSchema.parse(await request.json())
    const result = await changeMemberRole(
      auth.tenantId,
      body.userId,
      body.role as UserRole,
      auth.userId,
    )
    await invalidatePermissionCache(body.userId, auth.tenantId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
