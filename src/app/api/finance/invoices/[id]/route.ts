import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { invoiceUpdateSchema } from '@/lib/finance/financeSchemas'
import { getInvoice, updateInvoice } from '@/lib/finance/invoiceService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const record = await getInvoice(auth.tenantId, id)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = invoiceUpdateSchema.parse(await request.json())
    const record = await updateInvoice(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
