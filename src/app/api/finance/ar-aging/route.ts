import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getArAgingReport } from '@/lib/finance/invoiceService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const report = await getArAgingReport(auth.tenantId)
    return NextResponse.json(apiSuccess(report))
  } catch (err) {
    return handleRouteError(err)
  }
})
