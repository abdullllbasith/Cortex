import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { inventoryPredictionQuerySchema } from '@/lib/ml/schemas'
import { getInventoryPredictionResponse } from '@/lib/ml/predictionRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = inventoryPredictionQuerySchema.parse(parseQuery(request))
    const data = await getInventoryPredictionResponse(auth.tenantId, query.urgency)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
