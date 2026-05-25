import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { quoteCreateSchema, quoteListQuerySchema } from '@/lib/sales/salesSchemas'
import { createQuote, listQuotes } from '@/lib/sales/quoteService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = quoteListQuerySchema.parse(parseQuery(request))
    const result = await listQuotes(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = quoteCreateSchema.parse(await request.json())
    const record = await createQuote(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
