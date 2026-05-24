import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { salesPredictionQuerySchema } from '@/lib/ml/schemas'
import { getSalesPredictionResponse } from '@/lib/ml/predictionRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = salesPredictionQuerySchema.parse(parseQuery(request))
    const data = await getSalesPredictionResponse(
      auth.tenantId,
      parseInt(query.horizon, 10),
      query.granularity,
    )
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
