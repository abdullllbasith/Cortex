import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import {
  createStockTransfer,
  listStockTransfers,
} from '@/lib/inventory/inventoryWarehouseService'
import { transferStock } from '@/lib/inventory/stockEngine'

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']).optional(),
})

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

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = listSchema.parse(parseQuery(request))
    const result = await listStockTransfers(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess(result.transfers, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
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
