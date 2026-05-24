import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getEffectivePermissions } from '@/lib/auth/rbac'

export const GET = withTenantAuth(async (_request, { auth }) => {
  const permissions = await getEffectivePermissions(auth.userId, auth.tenantId)
  return NextResponse.json(apiSuccess({ permissions }))
})
