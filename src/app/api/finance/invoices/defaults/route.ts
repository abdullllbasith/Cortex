import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getInvoiceDefaults } from '@/lib/finance/invoiceService'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const defaults = await getInvoiceDefaults(auth.tenantId)
    return NextResponse.json(apiSuccess(defaults))
  } catch (err) {
    return handleRouteError(err)
  }
})
