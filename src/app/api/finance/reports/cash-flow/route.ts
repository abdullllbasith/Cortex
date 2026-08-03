import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { reportDateRangeSchema } from '@/lib/finance/financeSchemas'
import { getCashFlowStatement } from '@/lib/finance/reportingService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = reportDateRangeSchema.parse(parseQuery(request))
    const report = await getCashFlowStatement(auth.tenantId, query.startDate, query.endDate)
    return NextResponse.json(apiSuccess(report))
  } catch (err) {
    return handleRouteError(err)
  }
})
