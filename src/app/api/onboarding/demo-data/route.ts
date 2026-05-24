import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { seedDemoDataForTenant } from '@/lib/seed/demoDataSeed'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true'
    const result = await seedDemoDataForTenant(auth.tenantId, { force })

    return NextResponse.json(
      apiSuccess({
        ...result,
        message: result.seeded
          ? `Loaded ${result.salesEvents} demo sales events`
          : 'Demo data already exists for this workspace',
      }),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
