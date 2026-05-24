import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import {
  AdjustmentError,
  createStockAdjustment,
} from '@/lib/inventory/inventoryAdjustmentService'

const createSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  kind: z.enum(['increase', 'decrease', 'write_off', 'damage']).optional(),
  type: z.enum(['increase', 'decrease', 'write_off', 'damage']).optional(),
  quantity: z.number().positive(),
  reason: z.string().min(1).optional(),
  notes: z.string().optional(),
  managerConfirmed: z.boolean().optional(),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const kind = body.kind ?? body.type ?? 'increase'
    const result = await createStockAdjustment(auth.tenantId, {
      productId: body.productId,
      warehouseId: body.warehouseId,
      variantId: body.variantId,
      kind,
      quantity: body.quantity,
      reason: body.reason ?? body.notes ?? 'Stock adjustment',
      notes: body.notes,
      managerConfirmed: body.managerConfirmed,
      performedBy: auth.userId,
    })
    return NextResponse.json(apiSuccess(result), { status: 201 })
  } catch (err) {
    if (err instanceof AdjustmentError) {
      const status = err.code === 'CONFIRMATION_REQUIRED' ? 403 : 400
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: err.code, message: err.message, details: err.details },
        },
        { status },
      )
    }
    return handleRouteError(err)
  }
})
