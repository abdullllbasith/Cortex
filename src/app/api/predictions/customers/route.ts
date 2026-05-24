import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { customerPredictionQuerySchema } from '@/lib/ml/schemas'
import { getCustomerPredictionResponse } from '@/lib/ml/predictionRepository'

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = customerPredictionQuerySchema.parse(parseQuery(request))
    const data = await getCustomerPredictionResponse(
      auth.tenantId,
      query.risk,
      query.page,
      query.pageSize,
    )
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
