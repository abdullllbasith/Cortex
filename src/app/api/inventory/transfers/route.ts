import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { createStockTransfer } from '@/lib/inventory/inventoryWarehouseService'
import { transferStock } from '@/lib/inventory/stockEngine'

const transferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitCost: z.number().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
  executeNow: z.boolean().optional(),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = transferSchema.parse(await request.json())
    const transfer = await createStockTransfer(auth.tenantId, {
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId: body.toWarehouseId,
      items: [
        {
          productId: body.productId,
          variantId: body.variantId ?? undefined,
          quantity: body.quantity,
          unitCost: body.unitCost,
        },
      ],
      notes: body.notes,
      scheduledDate: body.scheduledDate,
      initiatedBy: auth.userId,
    })

    if (body.executeNow) {
      await transferStock(transfer.id, { completedBy: auth.userId })
    }

    return NextResponse.json(apiSuccess(transfer), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
