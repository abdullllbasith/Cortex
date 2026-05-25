import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError } from '@/lib/knowledge/apiHandler'
import { apiSuccess } from '@/lib/knowledge/response'
import { generateMatrixAndSync, syncProductVariants, generateVariantBarcode } from '@/lib/inventory/productVariantService'

const attributeSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
})

const syncSchema = z.object({
  action: z.enum(['sync', 'generate_matrix', 'generate_barcode']).default('sync'),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        sku: z.string().optional(),
        barcode: z.string().optional().nullable(),
        attributes: z.record(z.string(), z.string()).optional(),
        costPrice: z.number().optional().nullable(),
        sellingPrice: z.number().optional().nullable(),
        imageUrl: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .optional(),
  attributes: z.array(attributeSchema).optional(),
  variantId: z.string().optional(),
})

export const GET = withTenantAuth(async (_request, { auth, params }) => {
  try {
    const { id: productId } = await params
    const { listProductVariants } = await import('@/lib/inventory/productVariantService')
    const variants = await listProductVariants(auth.tenantId, productId)
    return NextResponse.json(
      apiSuccess(
        variants.map((v) => ({
          ...v,
          costPrice: v.costPrice?.toNumber() ?? null,
          sellingPrice: v.sellingPrice?.toNumber() ?? null,
          stockByWarehouse: v.stockBalances.map((b) => ({
            warehouseId: b.warehouseId,
            warehouse: b.warehouse,
            quantityOnHand: b.quantityOnHand.toNumber(),
            quantityReserved: b.quantityReserved.toNumber(),
          })),
        })),
      ),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth, params }) => {
  try {
    const { id: productId } = await params
    const body = syncSchema.parse(await request.json())

    if (body.action === 'generate_matrix') {
      if (!body.attributes?.length) throw new Error('Attributes required for matrix generation')
      const variants = await generateMatrixAndSync(auth.tenantId, productId, { attributes: body.attributes })
      return NextResponse.json(apiSuccess({ variants }))
    }

    if (body.action === 'generate_barcode') {
      if (!body.variantId) throw new Error('variantId required')
      const variant = await generateVariantBarcode(auth.tenantId, body.variantId)
      return NextResponse.json(apiSuccess(variant))
    }

    if (!body.variants) throw new Error('variants array required')
    const variants = await syncProductVariants(auth.tenantId, productId, body.variants)
    return NextResponse.json(apiSuccess({ variants }))
  } catch (err) {
    return handleRouteError(err)
  }
})
