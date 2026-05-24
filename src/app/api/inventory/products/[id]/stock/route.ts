import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getStockBalance } from '@/lib/inventory/stockEngine'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const balances = await getStockBalance(auth.tenantId, id)
    return NextResponse.json(apiSuccess(balances))
  } catch (err) {
    return handleRouteError(err)
  }
})
