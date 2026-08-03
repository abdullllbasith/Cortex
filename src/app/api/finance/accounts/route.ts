import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { accountCreateSchema, accountListQuerySchema } from '@/lib/finance/financeSchemas'
import { createAccount, getAccountsByType, getHierarchy, listAccounts } from '@/lib/finance/chartOfAccountsService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = accountListQuerySchema.parse(parseQuery(request))
    if (query.tree) {
      const tree = await getHierarchy(auth.tenantId)
      return NextResponse.json(apiSuccess({ tree }))
    }
    if (query.byType) {
      const groups = await getAccountsByType(auth.tenantId)
      return NextResponse.json(apiSuccess({ groups }))
    }
    const items = await listAccounts(auth.tenantId, { type: query.type, search: query.search })
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = accountCreateSchema.parse(await request.json())
    const record = await createAccount(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
