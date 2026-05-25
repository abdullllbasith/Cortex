import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { trialBalanceQuerySchema } from '@/lib/finance/financeSchemas'
import { getTrialBalance } from '@/lib/finance/journalEngine'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = trialBalanceQuerySchema.parse(parseQuery(request))
    const asOfDate = query.asOf ? new Date(query.asOf) : undefined
    const report = await getTrialBalance(auth.tenantId, asOfDate)
    return NextResponse.json(apiSuccess(report))
  } catch (err) {
    return handleRouteError(err)
  }
})
