import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { ledgerQuerySchema } from '@/lib/finance/financeSchemas'
import { getAccountLedger } from '@/lib/finance/chartOfAccountsService'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = ledgerQuerySchema.parse(parseQuery(request))
    const result = await getAccountLedger(auth.tenantId, id, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})
