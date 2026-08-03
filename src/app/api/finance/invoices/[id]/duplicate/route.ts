import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { duplicateInvoice } from '@/lib/finance/invoiceService'

export const POST = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const record = await duplicateInvoice(id, auth.tenantId, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
