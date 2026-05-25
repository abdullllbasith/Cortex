import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { paginationSchema } from '@/lib/knowledge/schemas'
import { listKnowledgeProducts } from '@/lib/knowledge/knowledgeProductSupplierService'
import { queryKnowledgeEntities } from '@/lib/knowledge/knowledgeEntityQuery'
import { createCatalogProduct } from '@/lib/inventory/inventoryCatalogService'
import type { StockHealth } from '@/lib/inventory/inventoryDashboardService'

const listQuerySchema = paginationSchema.extend({
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  stockHealth: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  semantic: z.coerce.boolean().optional(),
})

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = listQuerySchema.parse(parseQuery(request))
    const result =
      query.semantic && query.search
        ? await queryKnowledgeEntities(auth.tenantId, 'product', {
            search: query.search,
            page: query.page,
            limit: query.limit,
            semantic: true,
            productFilters: {
              categoryId: query.categoryId,
              supplierId: query.supplierId,
              stockHealth: query.stockHealth as StockHealth | undefined,
              minPrice: query.minPrice,
              maxPrice: query.maxPrice,
              status: query.status,
            },
          })
        : await listKnowledgeProducts(auth.tenantId, {
            page: query.page,
            limit: query.limit,
            search: query.search,
            categoryId: query.categoryId,
            supplierId: query.supplierId,
            stockHealth: query.stockHealth as StockHealth | undefined,
            minPrice: query.minPrice,
            maxPrice: query.maxPrice,
            status: query.status,
          })
    const { data, total, page, limit } = result
    return NextResponse.json(apiSuccess(data, paginatedMeta(page, limit, total)))
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
