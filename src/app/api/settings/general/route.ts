import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { requirePermission } from '@/lib/auth/rbac'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { tenantGeneralUpdateSchema } from '@/lib/settings/schemas'
import { getTenantGeneral, updateTenantGeneral } from '@/lib/settings/tenantSettingsService'

function appUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
}

export const GET = requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
  async (request, { auth }) => {
    try {
      const data = await getTenantGeneral(auth.tenantId, appUrl(request))
      return NextResponse.json(apiSuccess(data))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)

export const PUT = requirePermission(PERMISSIONS.SETTINGS_MANAGE)(
  async (request, { auth }) => {
    try {
      const body = tenantGeneralUpdateSchema.parse(await request.json())
      const data = await updateTenantGeneral(auth.tenantId, body, appUrl(request))
      return NextResponse.json(apiSuccess(data))
    } catch (err) {
      return handleRouteError(err)
    }
  },
)
