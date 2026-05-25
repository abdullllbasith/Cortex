import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { dealCreateSchema, dealListFiltersSchema } from '@/lib/crm/crmSchemas'
import { calculatePipelineValue, createDeal, listDeals } from '@/lib/crm/pipelineService'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = dealListFiltersSchema.parse(parseQuery(request))
    if (query.summary === 'true') {
      const summary = await calculatePipelineValue(auth.tenantId, query.pipelineId)
      return NextResponse.json(apiSuccess(summary))
    }
    const items = await listDeals(auth.tenantId, {
      pipelineId: query.pipelineId,
      ownerId: query.ownerId,
      valueMin: query.valueMin,
      valueMax: query.valueMax,
      closeFrom: query.closeFrom,
      closeTo: query.closeTo,
    })
    return NextResponse.json(apiSuccess({ items }))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = dealCreateSchema.parse(await request.json())
    const record = await createDeal(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
