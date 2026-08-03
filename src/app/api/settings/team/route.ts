import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { apiSuccess } from '@/lib/knowledge/response'
import { handleRouteError } from '@/lib/knowledge/apiHandler'
import { getTeamOverview } from '@/lib/settings/teamService'

export const GET = requirePermission(PERMISSIONS.TEAM_MANAGE)(async (_request, { auth }) => {
  try {
    const data = await getTeamOverview(auth.tenantId)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
