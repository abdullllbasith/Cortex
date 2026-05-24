import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import {
  createCatalogProduct,
  listCatalogProducts,
} from '@/lib/inventory/inventoryCatalogService'

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  stockHealth: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
})

const createSchema = z.object({
  name: z.string().min(1),
  sku: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  slug: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  unit: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  minSellingPrice: z.number().optional().nullable(),
  taxRate: z.number().default(0),
  imageUrls: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  reorderPoint: z.number().default(0),
  reorderQuantity: z.number().default(0),
  leadTimeDays: z.number().default(7),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = listSchema.parse(parseQuery(request))
    const result = await listCatalogProducts(auth.tenantId, query)
    return NextResponse.json(
      apiSuccess(result.items, paginatedMeta(result.page, result.limit, result.total)),
    )
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = createSchema.parse(await request.json())
    const product = await createCatalogProduct(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(product), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
