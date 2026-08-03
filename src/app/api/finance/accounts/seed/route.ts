import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { seedDefaultAccounts } from '@/lib/finance/chartOfAccountsService'
import { onboardingSetupSchema } from '@/lib/finance/financeSchemas'

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = onboardingSetupSchema.partial().parse(await request.json().catch(() => ({})))
    const result = await seedDefaultAccounts(auth.tenantId, {
      currency: body.currency,
      fiscalYearStart: body.fiscalYearStart,
    })
    return NextResponse.json(apiSuccess(result), { status: result.seeded ? 201 : 200 })
  } catch (err) {
    return handleRouteError(err)
  }
})
