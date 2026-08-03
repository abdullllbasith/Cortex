import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { invoicePaymentSchema } from '@/lib/finance/financeSchemas'
import { recordPayment } from '@/lib/finance/invoiceService'

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = invoicePaymentSchema.parse(await request.json())
    const record = await recordPayment(id, auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
