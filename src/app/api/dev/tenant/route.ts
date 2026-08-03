import { NextRequest, NextResponse } from 'next/server'
import { resolveDevBootstrapContext } from '@/lib/auth/resolveDevTenant'
import { apiSuccess, apiError } from '@/lib/knowledge/response'

export async function GET(request: NextRequest) {
  if (process.env.AUTH_DEV_MODE !== 'true') {
    return apiError('Not available', 'FORBIDDEN', 403)
  }

  const tenantId = request.nextUrl.searchParams.get('tenantId')
  const email = request.nextUrl.searchParams.get('email')
  const bootstrap = await resolveDevBootstrapContext({ tenantId, email })

  if (!bootstrap) {
    return apiError('No seed tenant found. Run npm run db:seed', 'NO_TENANT', 404)
  }

  return NextResponse.json(
    apiSuccess({
      ...bootstrap.tenant,
      user: bootstrap.user,
    }),
  )
}
