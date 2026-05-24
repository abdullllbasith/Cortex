import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { invalidatePermissionCache } from '@/lib/auth/rbac'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { setMemberStatus } from '@/lib/settings/teamService'

const schema = z.object({
  isActive: z.boolean(),
})

export const PUT = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (request, { auth, params }) => {
  try {
    const { userId } = await params
    const body = schema.parse(await request.json())
    const result = await setMemberStatus(auth.tenantId, userId, body.isActive, auth.userId)
    await invalidatePermissionCache(userId, auth.tenantId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
