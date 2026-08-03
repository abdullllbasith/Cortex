import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getSupplierPerformance } from '@/lib/inventory/supplierService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const metrics = await getSupplierPerformance(auth.tenantId, id)
    return NextResponse.json(apiSuccess(metrics))
  } catch (err) {
    return handleRouteError(err)
  }
})
