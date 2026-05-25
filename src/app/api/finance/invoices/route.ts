import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { invoiceCreateSchema, invoiceListQuerySchema } from '@/lib/finance/financeSchemas'
import { createInvoice, getInvoiceSummary, listInvoices } from '@/lib/finance/invoiceService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = invoiceListQuerySchema.parse(parseQuery(request))
    const result = await listInvoices(auth.tenantId, query)
    const summary = query.summary ? await getInvoiceSummary(auth.tenantId) : undefined
    return NextResponse.json(
      apiSuccess({ items: result.items, summary }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = invoiceCreateSchema.parse(await request.json())
    const record = await createInvoice(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
