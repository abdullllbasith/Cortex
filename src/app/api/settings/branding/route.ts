import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getTenantGeneral } from '@/lib/settings/tenantSettingsService'

function appUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
}

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const data = await getTenantGeneral(auth.tenantId, appUrl(request))
    return NextResponse.json(
      apiSuccess({
        name: data.name,
        logoUrl: data.settings.logoUrl ?? null,
        primaryColor: data.settings.primaryColor ?? null,
        secondaryColor: data.settings.secondaryColor ?? null,
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
