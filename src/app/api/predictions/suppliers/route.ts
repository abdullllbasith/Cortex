import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getSupplierPredictionResponse } from '@/lib/ml/predictionRepository'

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const data = await getSupplierPredictionResponse(auth.tenantId)
    return NextResponse.json(apiSuccess(data))
  } catch (err) {
    return handleRouteError(err)
  }
})
