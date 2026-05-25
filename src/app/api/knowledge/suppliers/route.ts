import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, handleRouteError, parseQuery } from '@/lib/knowledge/apiHandler'
import { apiSuccess, paginatedMeta } from '@/lib/knowledge/response'
import { paginationSchema, supplierCreateSchema } from '@/lib/knowledge/schemas'
import { knowledgeRepository } from '@/lib/knowledge/knowledgeRepository'
import { listKnowledgeSuppliers } from '@/lib/knowledge/knowledgeProductSupplierService'
import { queryKnowledgeEntities } from '@/lib/knowledge/knowledgeEntityQuery'
import { prisma } from '@/lib/db/prisma'

const listQuerySchema = paginationSchema.extend({
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  category: z.string().optional(),
  supplierType: z.string().optional(),
  paymentTerms: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  semantic: z.coerce.boolean().optional(),
})

export const GET = withTenantAuth(async (request, { auth }) => {
  try {
    const query = listQuerySchema.parse(parseQuery(request))
    const result =
      query.semantic && query.search
        ? await queryKnowledgeEntities(auth.tenantId, 'supplier', {
            search: query.search,
            page: query.page,
            limit: query.limit,
            semantic: true,
            supplierFilters: {
              minScore: query.minScore,
              maxScore: query.maxScore,
              paymentTerms: query.paymentTerms as never,
              supplierType: query.supplierType as never,
              status: query.status,
            },
          })
        : await listKnowledgeSuppliers(auth.tenantId, {
            page: query.page,
            limit: query.limit,
            search: query.search,
            minScore: query.minScore,
            maxScore: query.maxScore,
            category: query.category,
            supplierType: query.supplierType as never,
            paymentTerms: query.paymentTerms as never,
            status: query.status,
          })
    const { data, total, page, limit } = result
    return NextResponse.json(apiSuccess(data, paginatedMeta(page, limit, total)))
  } catch (err) {
    return handleRouteError(err)
  }
})

const createBodySchema = supplierCreateSchema.extend({
  contactEmail: z.string().email().optional(),
  code: z.string().optional(),
  type: z.string().optional(),
})

export const POST = withTenantAuth(async (request, { auth }) => {
  try {
    const raw = await request.json()
    const body = createBodySchema.parse(raw)
    const record = await knowledgeRepository.createSupplier(
      auth.tenantId,
      {
        ...body,
        reliabilityMetrics: {
          ...(body.reliabilityMetrics ?? {}),
          ...(raw.contactEmail && { contactEmail: raw.contactEmail }),
        },
      },
      auth.userId,
    )
    if (raw.contactEmail || raw.code || raw.type) {
      await prisma.supplier.update({
        where: { id: record.id },
        data: {
          ...(raw.contactEmail && { email: String(raw.contactEmail) }),
          ...(raw.code && { code: String(raw.code) }),
          ...(raw.type && { type: raw.type }),
        },
      })
    }
    return NextResponse.json(apiSuccess(record), { status: 201 })
  } catch (err) {
    return handleRouteError(err)
  }
})
