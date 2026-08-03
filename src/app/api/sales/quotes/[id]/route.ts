import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { quoteUpdateSchema } from '@/lib/sales/salesSchemas'
import { getQuote, updateQuote } from '@/lib/sales/quoteService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const record = await getQuote(auth.tenantId, id)
    if (!record) {
      return NextResponse.json({ error: { message: 'Quote not found' } }, { status: 404 })
    }
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const PUT = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id } = await params
    const body = quoteUpdateSchema.parse(await request.json())
    const record = await updateQuote(auth.tenantId, id, body, auth.userId)
    return NextResponse.json(apiSuccess(record))
  } catch (err) {
    return handleRouteError(err)
  }
})
