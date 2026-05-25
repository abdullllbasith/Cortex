import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { journalCreateSchema, journalListQuerySchema } from '@/lib/finance/financeSchemas'
import { listJournalEntries, post } from '@/lib/finance/journalEngine'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = journalListQuerySchema.parse(parseQuery(request))
    const result = await listJournalEntries(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess({ items: result.items }, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = journalCreateSchema.parse(await request.json())
    const record = await post(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
