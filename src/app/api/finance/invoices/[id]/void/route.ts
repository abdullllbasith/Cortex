import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { invoiceVoidSchema } from '@/lib/finance/financeSchemas'
import { voidInvoice } from '@/lib/finance/invoiceService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = invoiceVoidSchema.parse(await request.json())
    const record = await voidInvoice(id, auth.tenantId, body.reason, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
