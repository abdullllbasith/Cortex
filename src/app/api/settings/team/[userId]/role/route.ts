import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { invalidatePermissionCache } from '@/lib/auth/rbac'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { changeMemberRole } from '@/lib/settings/teamService'
import type { UserRole } from '@prisma/client'

const schema = z.object({
  role: z.enum(['OWNER', 'CEO', 'MANAGER', 'FINANCE_OFFICER', 'SALES_OFFICER', 'EMPLOYEE']),
})

export const PUT = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth, params }) => {
  try {
    const { userId } = await params
    const body = schema.parse(await request.json())
    const result = await changeMemberRole(
      auth.tenantId,
      userId,
      body.role as UserRole,
      auth.userId,
    )
    await invalidatePermissionCache(userId, auth.tenantId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
