import { NextResponse } from 'next/server'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { getWarehouseDetail } from '@/lib/inventory/inventoryWarehouseService'

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id } = await params
    const warehouse = await getWarehouseDetail(auth.tenantId, id)
    if (!warehouse) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Warehouse not found' } },
        { status: 404 },
      )
    }
    return NextResponse.json(apiSuccess(warehouse))
  } catch (err) {
    return handleRouteError(err)
  }
})
