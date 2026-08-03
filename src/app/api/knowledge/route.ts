import { NextResponse } from 'next/server'
import { z } from 'zod'
import { BusinessKnowledgeType } from '@prisma/client'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { knowledgeCreateSchema, paginationSchema } from '@/lib/knowledge/schemas'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { queryKnowledgeDocuments, queryKnowledgeEntities } from '@/lib/knowledge/knowledgeEntityQuery'

const entityQuerySchema = paginationSchema.extend({
  type: z.enum(['product', 'supplier', 'customer', 'knowledge']).optional(),
  semantic: z.coerce.boolean().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  stockHealth: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  supplierType: z.string().optional(),
  paymentTerms: z.string().optional(),
  minScore: z.coerce.number().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const raw = parseQuery(request)
    const query = entityQuerySchema.parse(raw)
    const entityType = raw.type as string | undefined

    if (entityType === 'product') {
      const result = await queryKnowledgeEntities(auth.tenantId, 'product', {
        search: query.search,
        page: query.page,
        limit: query.limit,
        semantic: query.semantic,
        productFilters: {
          categoryId: query.categoryId,
          supplierId: query.supplierId,
          stockHealth: query.stockHealth,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          status: query.status,
        },
      })
      return NextResponse.json(
        apiSuccess(result.data, paginatedMeta(result.page, result.limit, result.total)),
      )
    }

    if (entityType === 'supplier') {
      const result = await queryKnowledgeEntities(auth.tenantId, 'supplier', {
        search: query.search,
        page: query.page,
        limit: query.limit,
        semantic: query.semantic,
        supplierFilters: {
          minScore: query.minScore,
          paymentTerms: query.paymentTerms as never,
          supplierType: query.supplierType as never,
          status: query.status,
        },
      })
      return NextResponse.json(
        apiSuccess(result.data, paginatedMeta(result.page, result.limit, result.total)),
      )
    }

    const docType = entityType as BusinessKnowledgeType | undefined
    const { data, total } = await queryKnowledgeDocuments(auth.tenantId, {
      ...query,
      type: docType,
    })
    return NextResponse.json(apiSuccess(data, paginatedMeta(query.page, query.limit, total)))
  } catch (err) {
    return handleRouteError(err)
  }
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const body = knowledgeCreateSchema.parse(await request.json())
    const record = await knowledgeRepository.createKnowledge(auth.tenantId, body, auth.userId)
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
