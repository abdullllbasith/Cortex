import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { bulkUpdateProducts, exportProductsCsv } from '@/lib/inventory/inventoryCatalogService'

const bulkSchema = z.object({
  action: z.enum(['update', 'activate', 'deactivate', 'export']),
  productIds: z.array(z.string()).min(1),
  updates: z
    .object({
      categoryId: z.string().nullable().optional(),
      supplierId: z.string().nullable().optional(),
      costPrice: z.number().optional(),
      sellingPrice: z.number().optional(),
    })
    .optional(),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = bulkSchema.parse(await request.json())

    if (body.action === 'export') {
      const csv = await exportProductsCsv(auth.tenantId, body.productIds)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="products-export.csv"',
        },
      })
    }

    if (body.action === 'activate') {
      const result = await bulkUpdateProducts(auth.tenantId, body.productIds, { isActive: true }, auth.userId)
      return NextResponse.json(apiSuccess(result))
    }

    if (body.action === 'deactivate') {
      const result = await bulkUpdateProducts(auth.tenantId, body.productIds, { isActive: false }, auth.userId)
      return NextResponse.json(apiSuccess(result))
    }

    if (!body.updates) throw new Error('updates required for bulk edit')
    const result = await bulkUpdateProducts(auth.tenantId, body.productIds, body.updates, auth.userId)
    return NextResponse.json(apiSuccess(result))
  } catch (err) {
    return handleRouteError(err)
  }
})
