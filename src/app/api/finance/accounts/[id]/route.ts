import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { accountUpdateSchema, ledgerQuerySchema } from '@/lib/finance/financeSchemas'
import { getAccount, getAccountLedger, updateAccount } from '@/lib/finance/chartOfAccountsService'

export const GET = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const query = parseQuery(request)
    if (query.ledger === 'true') {
      const ledgerQuery = ledgerQuerySchema.parse(query)
      const ledger = await getAccountLedger(auth.tenantId, id, ledgerQuery)
      return NextResponse.json(apiSuccess(ledger))
    }
    const account = await getAccount(auth.tenantId, id)
    return NextResponse.json(apiSuccess(account))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = accountUpdateSchema.parse(await request.json())
    const record = await updateAccount(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
