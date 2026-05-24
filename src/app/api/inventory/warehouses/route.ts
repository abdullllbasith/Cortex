import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  createStockTransfer,
  createWarehouse,
  getWarehouseDetail,
  listWarehousesWithStats,
} from '@/lib/inventory/inventoryWarehouseService'

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  managerId: z.string().optional(),
})

export const GET = withTenantAuth(async (_request, { auth }) => {
  try {
    const warehouses = await listWarehousesWithStats(auth.tenantId)
    return NextResponse.json(apiSuccess(warehouses))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createWarehouseSchema.parse(await request.json())
    const warehouse = await createWarehouse(auth.tenantId, body)
    return NextResponse.json(apiSuccess(warehouse), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
