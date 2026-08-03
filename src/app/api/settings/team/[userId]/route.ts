import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { invalidatePermissionCache } from '@/lib/auth/rbac'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { removeMember } from '@/lib/settings/teamService'

export const DELETE = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (_request, { auth, params }) => {
  try {
    const { userId } = await params
    const result = await removeMember(auth.tenantId, userId, auth.userId)
    await invalidatePermissionCache(userId, auth.tenantId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
